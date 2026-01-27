// Liveness detection service - basic anti-spoofing
import type { LivenessChallenge } from "../types";
import { LIVENESS_FRAMES_REQUIRED } from "../utils/constants";
import { Logger } from "../utils/logger";
import { areEyesOpen, isHeadTurnedLeft, type DetectedFace } from "./faceDetection";

const logger = new Logger("Liveness");

export type LivenessChallengeType = "blink" | "turn-head-left";

export interface LivenessState {
  challenge: LivenessChallenge;
  framesCollected: number;
  framesRequired: number;
  passed: boolean;
}

class LivenessDetectionService {
  private currentChallenge: LivenessChallenge | null = null;
  private blinkDetection = { lastEyesOpen: null as boolean | null, blinkCount: 0 };
  private headTurnDetection = { detectionCount: 0 };
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
    const hasEyeData =
      face.leftEyeOpenProbability !== undefined &&
      face.rightEyeOpenProbability !== undefined;

    if (!hasEyeData) {
      const consistency = this.checkConsistency(face);
      const progress =
        (consistency.framesCollected / LIVENESS_FRAMES_REQUIRED) * 100;
      return { passed: consistency.passed, progress };
    }

    const eyesCurrentlyOpen = areEyesOpen(face);
    if (this.blinkDetection.lastEyesOpen === null) {
      this.blinkDetection.lastEyesOpen = eyesCurrentlyOpen;
      logger.debug(`Eyes detected ${eyesCurrentlyOpen ? "open" : "closed"}`);
    } else if (this.blinkDetection.lastEyesOpen && !eyesCurrentlyOpen) {
      this.blinkDetection.lastEyesOpen = false;
      logger.debug("Eyes detected closed");
    } else if (!this.blinkDetection.lastEyesOpen && eyesCurrentlyOpen) {
      this.blinkDetection.lastEyesOpen = true;
      this.blinkDetection.blinkCount += 1;
      logger.debug(`Blink detected (${this.blinkDetection.blinkCount}/2)`);
    }

    const passed = this.blinkDetection.blinkCount >= 1;
    const progress = Math.min(
      100,
      (this.blinkDetection.blinkCount / 1) * 100,
    );

    return { passed, progress };
  }

  private processHeadTurn(
    face: DetectedFace,
    direction: "left",
  ): { passed: boolean; progress: number } {
    if (face.headEulerAngleY === undefined) {
      const consistency = this.checkConsistency(face);
      const progress =
        (consistency.framesCollected / LIVENESS_FRAMES_REQUIRED) * 100;
      return { passed: consistency.passed, progress };
    }

    const isTurned = direction === "left" ? isHeadTurnedLeft(face) : false;

    if (isTurned) {
      this.headTurnDetection.detectionCount++;
      const angle = face.headEulerAngleY ?? 0;
      logger.debug(
        `Head turn ${direction} detected (angle: ${angle.toFixed(1)}°): ${this.headTurnDetection.detectionCount}/${LIVENESS_FRAMES_REQUIRED}`,
      );
    } else {
      // Decay detection count if not detecting turn anymore
      if (this.headTurnDetection.detectionCount > 0) {
        this.headTurnDetection.detectionCount = Math.max(
          0,
          this.headTurnDetection.detectionCount - 1,
        );
      }
    }

    const passed =
      this.headTurnDetection.detectionCount >= LIVENESS_FRAMES_REQUIRED;
    const progress =
      (this.headTurnDetection.detectionCount / LIVENESS_FRAMES_REQUIRED) * 100;

    return { passed, progress };
  }

  checkConsistency(face: DetectedFace): {
    passed: boolean;
    framesCollected: number;
  } {
    this.consistencyFrames++;
    const passed = this.consistencyFrames >= LIVENESS_FRAMES_REQUIRED;
    return { passed, framesCollected: this.consistencyFrames };
  }

  resetState(): void {
    this.blinkDetection = { lastEyesOpen: null, blinkCount: 0 };
    this.headTurnDetection = { detectionCount: 0 };
    this.consistencyFrames = 0;
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
