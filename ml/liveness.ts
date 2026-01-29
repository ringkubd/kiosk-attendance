// Liveness detection service - basic anti-spoofing
import type { LivenessChallenge } from "../types";
import { LIVENESS_FRAMES_REQUIRED } from "../utils/constants";
import { Logger } from "../utils/logger";
import { isHeadTurnedLeft, type DetectedFace } from "./faceDetection";

const logger = new Logger("Liveness");

export type LivenessChallengeType = "blink" | "turn-head-left";

export interface LivenessState {
  challenge: LivenessChallenge;
  framesCollected: number;
  framesRequired: number;
  passed: boolean;
}

const BLINK_CLOSED_THRESHOLD = 0.25;
const BLINK_OPEN_THRESHOLD = 0.65;
const BLINK_CONSECUTIVE_REQUIRED = 1; // Reduced from 2 to work on high-end devices
const BLINK_FALLBACK_MIN_SAMPLES = 2;
const BLINK_FALLBACK_MISSING_RATIO = 0.3;
const LIVENESS_FALLBACK_FRAMES_REQUIRED = 2;
const HEAD_TURN_GRACE_PERIOD_MS = 500; // Lock success state for 500ms
const HEAD_TURN_DECAY_DELAY_MS = 300; // Only start decaying after 300ms of no detection

type BlinkState = "OPEN" | "CLOSED_CONFIRMED" | "BLINK_SUCCESS";

class LivenessDetectionService {
  private currentChallenge: LivenessChallenge | null = null;
  private blinkDetection = {
    state: "OPEN" as BlinkState,
    closedConsecutive: 0,
    openConsecutive: 0,
    totalSamples: 0,
    missingEyeSamples: 0,
    missingConsecutive: 0,
    fallbackToHeadTurn: false,
    successTimestamp: 0, // Track when blink succeeded
  };
  private headTurnDetection = { 
    detectionCount: 0,
    successTimestamp: 0, // Track when head turn succeeded
    lastDetectionTimestamp: 0, // Track last time we detected a turn
  };
  private consistencyFrames = 0;

  generateChallenge(): LivenessChallenge {
    const challenges: LivenessChallengeType[] = ["blink", "turn-head-left"];
    const randomType =
      challenges[Math.floor(Math.random() * challenges.length)];

    let instruction = "";
    switch (randomType) {
      case "blink":
        instruction = "Please blink once";
        break;
      case "turn-head-left":
        instruction = "Please turn your head left";
        break;
    }

    this.currentChallenge = { type: randomType, instruction };
    this.resetState();
    logger.info(`Generated challenge: ${randomType}`);
    return this.currentChallenge;
  }

  processFrame(face: DetectedFace): { passed: boolean; progress: number } {
    if (!this.currentChallenge) {
      throw new Error("No active challenge. Call generateChallenge() first.");
    }

    let passed = false;
    let progress = 0;

    switch (this.currentChallenge.type) {
      case "blink":
        ({ passed, progress } = this.processBlink(face));
        break;
      case "turn-head-left":
        ({ passed, progress } = this.processHeadTurn(face, "left"));
        break;
    }

    if (passed) {
      logger.info("Liveness challenge passed");
    }

    return { passed, progress };
  }

  private processBlink(face: DetectedFace): {
    passed: boolean;
    progress: number;
  } {
    this.blinkDetection.totalSamples += 1;

    const left = face.leftEyeOpenProbability;
    const right = face.rightEyeOpenProbability;
    const hasEyeData =
      typeof left === "number" && typeof right === "number";

    if (!hasEyeData) {
      this.blinkDetection.missingEyeSamples += 1;
      this.blinkDetection.missingConsecutive += 1;
    } else {
      this.blinkDetection.missingConsecutive = 0;
    }

    if (this.shouldFallbackToHeadTurn()) {
      return this.processHeadTurn(
        face,
        "left",
        LIVENESS_FALLBACK_FRAMES_REQUIRED,
      );
    }

    if (!hasEyeData) {
      return this.getBlinkProgressResult();
    }

    const avgProb = (left + right) / 2;

    if (this.blinkDetection.state === "OPEN") {
      if (avgProb < BLINK_CLOSED_THRESHOLD) {
        this.blinkDetection.closedConsecutive += 1;
        logger.debug(
          `Eyes closing (${this.blinkDetection.closedConsecutive}/${BLINK_CONSECUTIVE_REQUIRED})`,
        );
        if (
          this.blinkDetection.closedConsecutive >= BLINK_CONSECUTIVE_REQUIRED
        ) {
          this.blinkDetection.state = "CLOSED_CONFIRMED";
          this.blinkDetection.openConsecutive = 0;
          logger.debug("Blink closed confirmed");
        }
      } else {
        this.blinkDetection.closedConsecutive = 0;
      }
    } else if (this.blinkDetection.state === "CLOSED_CONFIRMED") {
      if (avgProb > BLINK_OPEN_THRESHOLD) {
        this.blinkDetection.openConsecutive += 1;
        logger.debug(
          `Eyes reopening (${this.blinkDetection.openConsecutive}/${BLINK_CONSECUTIVE_REQUIRED})`,
        );
        if (this.blinkDetection.openConsecutive >= BLINK_CONSECUTIVE_REQUIRED) {
          this.blinkDetection.state = "BLINK_SUCCESS";
          logger.debug("Blink event detected");
        }
      } else {
        this.blinkDetection.openConsecutive = 0;
      }
    }

    return this.getBlinkProgressResult();
  }

  private processHeadTurn(
    face: DetectedFace,
    direction: "left",
    framesRequired: number = LIVENESS_FRAMES_REQUIRED,
  ): { passed: boolean; progress: number } {
    // Check if we're in grace period after success
    const now = Date.now();
    if (this.headTurnDetection.successTimestamp > 0) {
      const elapsed = now - this.headTurnDetection.successTimestamp;
      if (elapsed < HEAD_TURN_GRACE_PERIOD_MS) {
        return { passed: true, progress: 100 };
      }
    }

    if (face.headEulerAngleY === undefined) {
      const consistency = this.checkConsistency(face, framesRequired);
      const progress = (consistency.framesCollected / framesRequired) * 100;
      return { passed: consistency.passed, progress };
    }

    const isTurned = direction === "left" ? isHeadTurnedLeft(face) : false;

    if (isTurned) {
      this.headTurnDetection.detectionCount++;
      this.headTurnDetection.lastDetectionTimestamp = now;
      const angle = face.headEulerAngleY ?? 0;
      logger.debug(
        `Head turn ${direction} detected (angle: ${angle.toFixed(1)}°): ${this.headTurnDetection.detectionCount}/${framesRequired}`,
      );
    } else {
      // Time-based decay: only decay if we haven't seen a turn recently
      const timeSinceLastDetection = now - this.headTurnDetection.lastDetectionTimestamp;
      if (this.headTurnDetection.detectionCount > 0 && timeSinceLastDetection > HEAD_TURN_DECAY_DELAY_MS) {
        // Slow decay - only reduce by 1 every few frames on high-end devices
        this.headTurnDetection.detectionCount = Math.max(
          0,
          this.headTurnDetection.detectionCount - 1,
        );
      }
    }

    const passed = this.headTurnDetection.detectionCount >= framesRequired;
    if (passed && this.headTurnDetection.successTimestamp === 0) {
      this.headTurnDetection.successTimestamp = now;
    }

    const progress = Math.min(100, (this.headTurnDetection.detectionCount / framesRequired) * 100);

    return { passed, progress };
  }

  checkConsistency(
    face: DetectedFace,
    framesRequired: number = LIVENESS_FRAMES_REQUIRED,
  ): {
    passed: boolean;
    framesCollected: number;
  } {
    this.consistencyFrames++;
    const passed = this.consistencyFrames >= framesRequired;
    return { passed, framesCollected: this.consistencyFrames };
  }

  resetState(): void {
    this.blinkDetection = {
      state: "OPEN",
      closedConsecutive: 0,
      openConsecutive: 0,
      totalSamples: 0,
      missingEyeSamples: 0,
      missingConsecutive: 0,
      fallbackToHeadTurn: false,
      successTimestamp: 0,
    };
    this.headTurnDetection = { 
      detectionCount: 0,
      successTimestamp: 0,
      lastDetectionTimestamp: 0,
    };
    this.consistencyFrames = 0;
  }

  private shouldFallbackToHeadTurn(): boolean {
    const {
      totalSamples,
      missingEyeSamples,
      missingConsecutive,
      fallbackToHeadTurn,
    } =
      this.blinkDetection;
    if (fallbackToHeadTurn) return true;
    if (totalSamples < BLINK_FALLBACK_MIN_SAMPLES) return false;
    const ratio = missingEyeSamples / totalSamples;
    if (missingConsecutive >= 2 || ratio > BLINK_FALLBACK_MISSING_RATIO) {
      this.blinkDetection.fallbackToHeadTurn = true;
      logger.debug(
        `Eye data missing ratio ${(ratio * 100).toFixed(0)}%, fallback to head turn`,
      );
      return true;
    }
    return false;
  }

  private getBlinkProgressResult(): { passed: boolean; progress: number } {
    const passed = this.blinkDetection.state === "BLINK_SUCCESS";
    
    // If we succeeded, stay at 100% for grace period
    if (passed) {
      if (this.blinkDetection.successTimestamp === 0) {
        this.blinkDetection.successTimestamp = Date.now();
      }
      return { passed: true, progress: 100 };
    }

    const progress =
      this.blinkDetection.state === "OPEN"
        ? 0
        : this.blinkDetection.state === "CLOSED_CONFIRMED"
          ? 50
          : 100;
    return { passed, progress };
  }

  getCurrentChallenge(): LivenessChallenge | null {
    return this.currentChallenge;
  }
}

export const livenessService = new LivenessDetectionService();

export const generateChallenge = (): LivenessChallenge =>
  livenessService.generateChallenge();

export const processLivenessFrame = (face: DetectedFace) =>
  livenessService.processFrame(face);

export const resetLiveness = () => livenessService.resetState();
