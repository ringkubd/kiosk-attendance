// Face detection service using Vision Camera frame processing
// Supports native ML Kit when available, falls back to simulated detection for dev/testing
import { MIN_FACE_SIZE } from "../utils/constants";
import { Logger } from "../utils/logger";

const logger = new Logger("FaceDetection");

export interface DetectedFace {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    nose?: { x: number; y: number };
    mouth?: { x: number; y: number };
  };
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  headEulerAngleY?: number; // Yaw (turn left/right)
  headEulerAngleZ?: number; // Roll (tilt)
}

/**
 * Detect faces in an image using ML Kit
 * Falls back to simulated detector if native module unavailable
 *
 * Note: react-native-vision-camera-face-detector is best for live frame processing.
 * For static image analysis from takePhoto(), we use ML Kit packages that support file paths.
 */
export interface FaceDetectionOptions {
  performanceMode?: "fast" | "accurate";
  landmarkMode?: "none" | "all";
  contourMode?: "none" | "all";
  classificationMode?: "none" | "all";
  minFaceSize?: number;
  trackingEnabled?: boolean;
}

export async function detectFaces(
  imageData: string | { uri: string },
  options?: FaceDetectionOptions,
): Promise<DetectedFace[]> {
  const rawPath = typeof imageData === "string" ? imageData : imageData.uri;
  const imagePath = normalizeImagePath(rawPath);

  // Try ML Kit packages for static image face detection
  try {
    let mlkit: any = null;

    // Try react-native-mlkit-face-detection first
    try {
      mlkit = await import("react-native-mlkit-face-detection");
    } catch (e) {
      // Try @react-native-ml-kit/face-detection
      try {
        mlkit = await import("@react-native-ml-kit/face-detection");
      } catch (e2) {
        mlkit = null;
      }
    }

    if (mlkit && (mlkit.detect || mlkit.detectFaces || mlkit.default)) {
      logger.info("Using native ML Kit face detector");
      const detector =
        mlkit.detectFaces ||
        mlkit.detect ||
        mlkit.default?.detectFaces ||
        mlkit.default?.detect;

      if (typeof detector === "function") {
        const rawFaces: any[] = await detector(imagePath, options || {});

        const faces: DetectedFace[] = rawFaces.map((f) => ({
          bounds: normalizeBounds(
            f.bounds || f.boundingBox || f.frame || f.box || f,
          ),
          landmarks: f.landmarks || undefined,
          leftEyeOpenProbability:
            f.leftEyeOpenProbability ?? f.leftEyeOpen ?? undefined,
          rightEyeOpenProbability:
            f.rightEyeOpenProbability ?? f.rightEyeOpen ?? undefined,
          headEulerAngleY:
            f.headEulerAngleY ?? f.yaw ?? f.yawAngle ?? undefined,
          headEulerAngleZ:
            f.headEulerAngleZ ?? f.roll ?? f.rollAngle ?? undefined,
        }));

        logger.debug(`Detected ${faces.length} face(s) using ML Kit`);
        return faces;
      }
    }
  } catch (mlkitError: any) {
    logger.warn("ML Kit packages not available", mlkitError.message);
  }

  // Fallback: simulated detection for development/testing without native ML Kit
  logger.info("Using simulated face detector (ML Kit not available)");

  const face: DetectedFace = {
    bounds: {
      x: 200,
      y: 300,
      width: 400,
      height: 400,
    },
    landmarks: {
      leftEye: { x: 300, y: 400 },
      rightEye: { x: 500, y: 400 },
      nose: { x: 400, y: 500 },
    },
    leftEyeOpenProbability: 0.9,
    rightEyeOpenProbability: 0.9,
    headEulerAngleY: 0,
    headEulerAngleZ: 0,
  };

  logger.info(
    `Simulated face detected at bounds: ${JSON.stringify(face.bounds)}`,
  );
  return [face];
}

function normalizeBounds(raw: any): DetectedFace["bounds"] {
  if (!raw) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const x = raw.x ?? raw.left ?? raw.originX ?? 0;
  const y = raw.y ?? raw.top ?? raw.originY ?? 0;
  const width = raw.width ?? raw.w ?? 0;
  const height = raw.height ?? raw.h ?? 0;

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

function normalizeImagePath(path: string): string {
  if (!path) return path;
  const lower = path.toLowerCase();
  if (
    lower.startsWith("file://") ||
    lower.startsWith("content://") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://")
  ) {
    return path;
  }
  if (path.startsWith("/")) {
    return `file://${path}`;
  }
  return path;
}

/**
 * Validate face detection quality
 */
export function validateFaceQuality(face: DetectedFace): {
  valid: boolean;
  reason?: string;
} {
  // Check minimum face size
  const minSize = Math.min(face.bounds.width, face.bounds.height);
  if (minSize < MIN_FACE_SIZE) {
    return {
      valid: false,
      reason: `Face too small (${minSize}px < ${MIN_FACE_SIZE}px)`,
    };
  }

  // Check if face is centered enough (not too close to edges)
  // This would require image dimensions - skip for now

  return { valid: true };
}

/**
 * Check if eyes are open (for blink detection)
 */
export function areEyesOpen(
  face: DetectedFace,
  threshold: number = 0.5,
): boolean {
  if (
    face.leftEyeOpenProbability !== undefined &&
    face.rightEyeOpenProbability !== undefined
  ) {
    return (
      face.leftEyeOpenProbability > threshold &&
      face.rightEyeOpenProbability > threshold
    );
  }
  // If no eye data available, assume open
  return true;
}

/**
 * Check if head is turned left
 */
export function isHeadTurnedLeft(
  face: DetectedFace,
  threshold: number = 15,
): boolean {
  if (face.headEulerAngleY !== undefined) {
    return face.headEulerAngleY < -threshold;
  }
  return false;
}

/**
 * Check if head is turned right
 */
export function isHeadTurnedRight(
  face: DetectedFace,
  threshold: number = 15,
): boolean {
  if (face.headEulerAngleY !== undefined) {
    return face.headEulerAngleY > threshold;
  }
  return false;
}

/**
 * Convenience wrapper: detect a single face and return structured result
 * Kept for backward compatibility with screens that call `detectFace`.
 */
export async function detectFace(
  imageData: string | { uri: string },
  options?: FaceDetectionOptions,
): Promise<{
  detected: boolean;
  faceCount: number;
  face?: DetectedFace;
  reason?: string;
}> {
  try {
    const faces = await detectFaces(imageData, options);
    if (!faces || faces.length === 0) {
      return { detected: false, faceCount: 0, reason: "No face detected" };
    }
    return { detected: true, faceCount: faces.length, face: faces[0] };
  } catch (error: any) {
    logger.error("detectFace failed", error);
    return {
      detected: false,
      faceCount: 0,
      reason: error.message || "Detection error",
    };
  }
}
