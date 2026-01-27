// Face recognition service - detection, preprocessing, inference, and matching
import { getAllActiveEmployees } from "../db/database";
import type { RecognitionResult } from "../types";
import { RECOGNITION_THRESHOLD } from "../utils/constants";
import { cosineSimilarity } from "../utils/helpers";
import { Logger } from "../utils/logger";
import { getActiveOrgBranchIds } from "../services/settings";
import {
  detectFaces,
  validateFaceQuality,
  type DetectedFace,
} from "./faceDetection";
import {
  isModelInitialized as isModelLoaded,
  initializeModel,
  runInference,
} from "./onnxInference";
import { preprocessImage } from "./preprocessor";

const logger = new Logger("FaceRecognition");

class FaceRecognitionService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized && isModelLoaded()) {
      return;
    }
    await initializeModel();
    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized && isModelLoaded();
  }

  private async ensureReady(): Promise<void> {
    if (!this.isReady()) {
      await this.initialize();
    }
  }

  /**
   * Recognize a face from an image path.
   * Returns null if no match meets the threshold.
   */
  async recognizeFace(
    imagePath: string,
    threshold: number = RECOGNITION_THRESHOLD,
  ): Promise<RecognitionResult | null> {
    await this.ensureReady();

    // Step 1: Detect faces
    const faces = await detectFaces(imagePath, {
      performanceMode: "fast",
    });
    if (!faces || faces.length === 0) {
      logger.warn("No face detected");
      return null;
    }
    if (faces.length !== 1) {
      logger.warn("Multiple faces detected; rejecting frame");
      return null;
    }

    return this.recognizeFaceWithDetection(imagePath, faces[0], threshold);
  }

  /**
   * Recognize a face when detection results are already available.
   * Avoids a second ML Kit pass for faster kiosk flow.
   */
  async recognizeFaceWithDetection(
    imagePath: string,
    face: DetectedFace,
    threshold: number = RECOGNITION_THRESHOLD,
  ): Promise<RecognitionResult | null> {
    await this.ensureReady();

    // Quality gate
    const quality = validateFaceQuality(face);
    if (!quality.valid) {
      logger.warn(`Face quality failed: ${quality.reason || "unknown"}`);
      return null;
    }

    // Preprocess image to tensor
    const inputTensor = await preprocessImage(imagePath, face.bounds);

    // Inference
    const embedding = await runInference(inputTensor);

    // Match against active employees
    const { orgId, branchId } = await getActiveOrgBranchIds();
    const employees = await getAllActiveEmployees(orgId, branchId);
    if (employees.length === 0) {
      logger.warn("No active employees in database");
      return null;
    }

    let bestMatch: RecognitionResult | null = null;
    let bestScore = -1;

    for (const employee of employees) {
      if (!employee.embedding_avg) continue;

      if (embedding.length !== employee.embedding_avg.length) {
        logger.warn(
          `Embedding size mismatch for employee ${employee.id}: model=${embedding.length}, stored=${employee.embedding_avg.length}`,
        );
        continue;
      }

      const similarity = cosineSimilarity(embedding, employee.embedding_avg);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = {
          employeeId: employee.id,
          employeeName: employee.name,
          confidence: similarity,
          embedding,
        };
      }
    }

    if (bestMatch && bestMatch.confidence >= threshold) {
      logger.info(
        `Recognized ${bestMatch.employeeName} with confidence ${bestMatch.confidence.toFixed(3)}`,
      );
      return bestMatch;
    }

    logger.info(`No match above threshold ${threshold}`);
    return null;
  }
  /**
   * Enroll a new embedding from an image path.
   */
  async enrollEmployee(imagePath: string): Promise<Float32Array> {
    await this.ensureReady();

    const faces = await detectFaces(imagePath);
    if (!faces || faces.length === 0) {
      throw new Error("No face detected for enrollment");
    }
    const face = faces[0];
    const quality = validateFaceQuality(face);
    if (!quality.valid) {
      throw new Error(quality.reason || "Face quality insufficient");
    }

    const inputTensor = await preprocessImage(imagePath, face.bounds);
    const embedding = await runInference(inputTensor);
    return embedding;
  }
}

export const faceRecognitionService = new FaceRecognitionService();

export async function recognizeFace(
  imagePath: string,
  threshold: number = RECOGNITION_THRESHOLD,
): Promise<RecognitionResult | null> {
  return faceRecognitionService.recognizeFace(imagePath, threshold);
}

export async function recognizeFaceWithDetection(
  imagePath: string,
  face: DetectedFace,
  threshold: number = RECOGNITION_THRESHOLD,
): Promise<RecognitionResult | null> {
  return faceRecognitionService.recognizeFaceWithDetection(
    imagePath,
    face,
    threshold,
  );
}

export async function enrollFaceSample(imagePath: string): Promise<Float32Array> {
  return faceRecognitionService.enrollEmployee(imagePath);
}
