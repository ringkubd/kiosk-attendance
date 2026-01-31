// Liveness detection service - basic anti-spoofing
import type { LivenessChallenge } from "../types";
import { LIVENESS_FRAMES_REQUIRED } from "../utils/constants";
import { Logger } from "../utils/logger";
import type { DetectedFace } from "./faceDetection";

const logger = new Logger("Liveness");

// Head turn thresholds based on euler angles and landmarks
const HEAD_TURN_ANGLE_THRESHOLD = 12; // degrees min turn required (more sensitive)
const HEAD_TURN_ANGLE_SUSTAINED_THRESHOLD = 8; // degrees to maintain turn after calibration
const HEAD_TURN_LANDMARK_THRESHOLD = 25; // pixels of eye/nose movement
const HEAD_TURN_MIN_FRAMES_REQUIRED = 2; // minimum stable frames
const HEAD_TURN_DECAY_RATE = 0.4; // aggressive decay per frame when not turning
const HEAD_TURN_NEUTRAL_ZONE = 5; // degrees of hysteresis to prevent flipping

export type LivenessChallengeType =
  | "blink"
  | "turn-head-left"
  | "turn-head-right";

export interface LivenessState {
  challenge: LivenessChallenge;
  framesCollected: number;
  framesRequired: number;
  passed: boolean;
}

const BLINK_CLOSED_THRESHOLD = 0.25;
const BLINK_OPEN_THRESHOLD = 0.65;
const BLINK_CONSECUTIVE_REQUIRED = 1;
const BLINK_FALLBACK_MIN_SAMPLES = 2;
const BLINK_FALLBACK_MISSING_RATIO = 0.3;

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
    successTimestamp: 0,
  };
  private headTurnDetection = {
    detectionScore: 0, // Accumulating score (0-1)
    frameSinceLastConfirm: 0, // Frames since last positive detection
    baselineLeftEyeX: 0,
    baselineNoseX: 0,
    calibratedAngleDirection: 0, // +1 (positive=left), -1 (negative=left), 0 (uncalibrated)
    angleHistory: [] as number[], // Track last 5 angles for smoothing
    maxAngleSeen: 0, // Track max angle magnitude for confidence
  };
  private consistencyFrames = 0;

  generateChallenge(): LivenessChallenge {
    const challenges: LivenessChallengeType[] = [
      "blink",
      "turn-head-left",
      "turn-head-right",
    ];
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
      case "turn-head-right":
        instruction = "Please turn your head right";
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
      case "turn-head-right":
        ({ passed, progress } = this.processHeadTurn(face, "right"));
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
    const hasEyeData = typeof left === "number" && typeof right === "number";

    if (!hasEyeData) {
      this.blinkDetection.missingEyeSamples += 1;
      this.blinkDetection.missingConsecutive += 1;
    } else {
      this.blinkDetection.missingConsecutive = 0;
    }

    if (this.shouldFallbackToHeadTurn()) {
      return this.processHeadTurn(face, "left");
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
    direction: "left" | "right" = "left",
  ): { passed: boolean; progress: number } {
    let isTurned = false;

    // Try euler angle detection first (most reliable)
    if (face.headEulerAngleY !== undefined) {
      isTurned = this.detectHeadTurnViaEulerAngle(face, direction);
      logger.debug(
        `Head angle: ${face.headEulerAngleY.toFixed(1)}°, turned (${direction}): ${isTurned}`,
      );
    } else if (face.landmarks?.leftEye && face.landmarks?.nose) {
      // Fallback: use landmarks to detect head position
      isTurned = this.detectHeadTurnViaLandmarks(face, direction);
      logger.debug(`Landmark-based detection (${direction}): ${isTurned}`);
    } else {
      // Can't detect turn without euler angles or landmarks
      logger.debug("No head turn detection data available");
    }

    // Update detection score with decay
    if (isTurned) {
      this.headTurnDetection.detectionScore = Math.min(
        1.0,
        this.headTurnDetection.detectionScore + 0.5,
      );
      this.headTurnDetection.frameSinceLastConfirm = 0;
    } else {
      // Aggressive decay when not turning
      this.headTurnDetection.detectionScore = Math.max(
        0,
        this.headTurnDetection.detectionScore - HEAD_TURN_DECAY_RATE,
      );
      this.headTurnDetection.frameSinceLastConfirm++;
    }

    const passed =
      this.headTurnDetection.detectionScore >= 1.0 &&
      this.headTurnDetection.frameSinceLastConfirm < 2; // Must be recent
    const progress = Math.min(100, this.headTurnDetection.detectionScore * 100);

    logger.debug(
      `[Progress] ${direction}: ${progress.toFixed(0)}% (score: ${this.headTurnDetection.detectionScore.toFixed(2)}, recent: ${this.headTurnDetection.frameSinceLastConfirm}, passed: ${passed})`,
    );

    return { passed, progress };
  }

  private detectHeadTurnViaEulerAngle(
    face: DetectedFace,
    direction: "left" | "right",
  ): boolean {
    const angle = face.headEulerAngleY || 0;

    // Keep rolling history for smoothing
    this.headTurnDetection.angleHistory.push(angle);
    if (this.headTurnDetection.angleHistory.length > 5) {
      this.headTurnDetection.angleHistory.shift();
    }

    // Auto-calibrate angle direction from first significant movement
    if (this.headTurnDetection.calibratedAngleDirection === 0) {
      if (Math.abs(angle) > HEAD_TURN_ANGLE_THRESHOLD) {
        this.headTurnDetection.calibratedAngleDirection = angle > 0 ? 1 : -1;
        this.headTurnDetection.maxAngleSeen = Math.abs(angle);
        logger.debug(
          `[Calibration] Angle direction: ${this.headTurnDetection.calibratedAngleDirection > 0 ? "positive" : "negative"} → left turn, angle: ${angle.toFixed(1)}°`,
        );
      }
      return false;
    }

    // Smooth angle using history
    const smoothedAngle =
      this.headTurnDetection.angleHistory.length > 0
        ? this.headTurnDetection.angleHistory.reduce((a, b) => a + b) /
          this.headTurnDetection.angleHistory.length
        : angle;

    // Track max angle seen for confidence metrics
    if (
      Math.abs(smoothedAngle) > Math.abs(this.headTurnDetection.maxAngleSeen)
    ) {
      this.headTurnDetection.maxAngleSeen = smoothedAngle;
    }

    const calibDir = this.headTurnDetection.calibratedAngleDirection;
    let isTurned = false;

    if (direction === "left") {
      // Expected direction for left turn
      if (calibDir > 0) {
        // Device reports positive angles for left
        isTurned = smoothedAngle > HEAD_TURN_ANGLE_SUSTAINED_THRESHOLD;
      } else {
        // Device reports negative angles for left
        isTurned = smoothedAngle < -HEAD_TURN_ANGLE_SUSTAINED_THRESHOLD;
      }
    } else if (direction === "right") {
      // Expected direction for right turn (opposite of left)
      if (calibDir > 0) {
        // Device reports positive angles for left → negative for right
        isTurned = smoothedAngle < -HEAD_TURN_ANGLE_SUSTAINED_THRESHOLD;
      } else {
        // Device reports negative angles for left → positive for right
        isTurned = smoothedAngle > HEAD_TURN_ANGLE_SUSTAINED_THRESHOLD;
      }
    }

    logger.debug(
      `[AngleCheck] raw: ${angle.toFixed(1)}°, smoothed: ${smoothedAngle.toFixed(1)}°, dir: ${direction}, turned: ${isTurned}, max: ${this.headTurnDetection.maxAngleSeen.toFixed(1)}°`,
    );

    return isTurned;
  }

  private detectHeadTurnViaLandmarks(
    face: DetectedFace,
    direction: "left" | "right",
  ): boolean {
    const leftEye = face.landmarks?.leftEye;
    const nose = face.landmarks?.nose;
    const rightEye = face.landmarks?.rightEye;

    if (!leftEye || !nose || !rightEye) {
      return false;
    }

    // Initialize baseline on first detection
    if (this.headTurnDetection.baselineLeftEyeX === 0) {
      this.headTurnDetection.baselineLeftEyeX = (leftEye.x + rightEye.x) / 2;
      this.headTurnDetection.baselineNoseX = nose.x;
      return false;
    }

    // Calculate eye center and nose relative movement
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeShift = eyeCenterX - this.headTurnDetection.baselineLeftEyeX;
    const noseShift = nose.x - this.headTurnDetection.baselineNoseX;

    let turnDetected = false;

    if (direction === "left") {
      // Left turn: nose moves left (negative), eyes move left too
      turnDetected =
        noseShift < -HEAD_TURN_LANDMARK_THRESHOLD &&
        eyeShift < -HEAD_TURN_LANDMARK_THRESHOLD / 2;
    } else if (direction === "right") {
      // Right turn: nose moves right (positive), eyes move right too
      turnDetected =
        noseShift > HEAD_TURN_LANDMARK_THRESHOLD &&
        eyeShift > HEAD_TURN_LANDMARK_THRESHOLD / 2;
    }

    logger.debug(
      `[Landmarks-${direction}] nose: ${noseShift.toFixed(0)}px, eyes: ${eyeShift.toFixed(0)}px, detected: ${turnDetected}`,
    );

    return turnDetected;
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
      detectionScore: 0,
      frameSinceLastConfirm: 0,
      baselineLeftEyeX: 0,
      baselineNoseX: 0,
      calibratedAngleDirection: 0,
      angleHistory: [],
      maxAngleSeen: 0,
    };
    this.consistencyFrames = 0;
  }

  private shouldFallbackToHeadTurn(): boolean {
    const {
      totalSamples,
      missingEyeSamples,
      missingConsecutive,
      fallbackToHeadTurn,
    } = this.blinkDetection;
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
