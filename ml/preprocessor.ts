// Image preprocessing for face recognition
import { decode as base64Decode } from "base-64";
import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { Image } from "react-native";
import { FACE_SIZE } from "../utils/constants";
import { Logger } from "../utils/logger";
import type { DetectedFace } from "./faceDetection";

const logger = new Logger("Preprocessor");

export interface ImageData {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Crop face region from image
 */
export function cropFace(
  imageData: ImageData,
  faceBounds: DetectedFace["bounds"],
): ImageData {
  const { x, y, width, height } = faceBounds;
  const croppedData = new Uint8Array(width * height * 4); // RGBA

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const dstIdx = (row * width + col) * 4;

      croppedData[dstIdx] = imageData.data[srcIdx]; // R
      croppedData[dstIdx + 1] = imageData.data[srcIdx + 1]; // G
      croppedData[dstIdx + 2] = imageData.data[srcIdx + 2]; // B
      croppedData[dstIdx + 3] = imageData.data[srcIdx + 3]; // A
    }
  }

  return {
    data: croppedData,
    width,
    height,
  };
}

/**
 * Resize image using bilinear interpolation
 */
export function resizeImage(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  const { data, width, height } = imageData;
  const resizedData = new Uint8Array(targetWidth * targetHeight * 4);

  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let row = 0; row < targetHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const srcX = col * xRatio;
      const srcY = row * yRatio;

      const x1 = Math.floor(srcX);
      const x2 = Math.min(x1 + 1, width - 1);
      const y1 = Math.floor(srcY);
      const y2 = Math.min(y1 + 1, height - 1);

      const dx = srcX - x1;
      const dy = srcY - y1;

      for (let c = 0; c < 3; c++) {
        const p1 = data[(y1 * width + x1) * 4 + c];
        const p2 = data[(y1 * width + x2) * 4 + c];
        const p3 = data[(y2 * width + x1) * 4 + c];
        const p4 = data[(y2 * width + x2) * 4 + c];

        const value =
          p1 * (1 - dx) * (1 - dy) +
          p2 * dx * (1 - dy) +
          p3 * (1 - dx) * dy +
          p4 * dx * dy;

        resizedData[(row * targetWidth + col) * 4 + c] = value;
      }
      resizedData[(row * targetWidth + col) * 4 + 3] = 255; // Alpha
    }
  }

  return {
    data: resizedData,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Convert RGBA image to RGB float32 tensor in CHW order
 */
export function imageToTensor(
  imageData: ImageData,
  normalize: boolean = true,
): Float32Array {
  const { data, width, height } = imageData;
  const tensorSize = 3 * width * height;
  const tensor = new Float32Array(tensorSize);

  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      const pixelIdx = (h * width + w) * 4;
      const tensorBaseIdx = h * width + w;

      tensor[tensorBaseIdx] = data[pixelIdx];
      tensor[height * width + tensorBaseIdx] = data[pixelIdx + 1];
      tensor[2 * height * width + tensorBaseIdx] = data[pixelIdx + 2];
    }
  }

  if (normalize) {
    for (let i = 0; i < tensor.length; i++) {
      tensor[i] = tensor[i] / 255.0;
    }
  }

  return tensor;
}

/**
 * Preprocess face image for MobileFaceNet from an in-memory ImageData
 */
export function preprocessFace(
  imageData: ImageData,
  faceBounds: DetectedFace["bounds"],
): Float32Array {
  try {
    logger.debug("Preprocessing face", faceBounds);

    const cropped = cropFace(imageData, faceBounds);
    const resized = resizeImage(cropped, FACE_SIZE, FACE_SIZE);
    const tensor = imageToTensor(resized, true);

    logger.debug(`Preprocessed face to tensor of size ${tensor.length}`);
    return tensor;
  } catch (error) {
    logger.error("Face preprocessing failed", error);
    throw error;
  }
}

/**
 * Load image from file path and preprocess for face recognition
 * Steps:
 * 1. Crop with padding
 * 2. Resize to 112x112
 * 3. Decode JPEG -> RGBA
 * 4. Convert to normalized Float32 tensor (CHW)
 */
export async function preprocessImage(
  imagePath: string,
  faceBounds: DetectedFace["bounds"],
): Promise<Float32Array> {
  try {
    logger.debug("Loading and preprocessing image from", imagePath);

    const normalizedPath = normalizeImagePath(imagePath);
    const { width: imageWidth, height: imageHeight } =
      await getImageSize(normalizedPath);

    const padding = 0.2; // 20% padding around detected face
    const paddedWidth = faceBounds.width * (1 + padding * 2);
    const paddedHeight = faceBounds.height * (1 + padding * 2);
    const paddedX = faceBounds.x - faceBounds.width * padding;
    const paddedY = faceBounds.y - faceBounds.height * padding;

    const crop = clampCropRect(
      imageWidth,
      imageHeight,
      paddedX,
      paddedY,
      paddedWidth,
      paddedHeight,
    );

    const manipulated = await ImageManipulator.manipulateAsync(
      normalizedPath,
      [
        {
          crop: {
            originX: crop.x,
            originY: crop.y,
            width: crop.width,
            height: crop.height,
          },
        },
        { resize: { width: FACE_SIZE, height: FACE_SIZE } },
      ],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );

    if (!manipulated.base64) {
      throw new Error("Failed to get base64 data from image manipulation");
    }

    const imageData = decodeBase64ToImageData(manipulated.base64);
    const tensor = imageToTensor(imageData, true);

    logger.debug(`Preprocessed image to tensor of size ${tensor.length}`);
    return tensor;
  } catch (error) {
    logger.error("preprocessImage failed", error);
    throw error;
  }
}

function decodeBase64ToImageData(base64: string): ImageData {
  try {
    const cleaned = base64.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = base64Decode(cleaned);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decoded = jpeg.decode(bytes, { useTArray: true });

    if (!decoded || !decoded.data) {
      throw new Error("Failed to decode JPEG data");
    }

    return {
      data: decoded.data,
      width: decoded.width,
      height: decoded.height,
    };
  } catch (error) {
    logger.error("Failed to decode base64 image", error);
    return {
      data: new Uint8Array(FACE_SIZE * FACE_SIZE * 4),
      width: FACE_SIZE,
      height: FACE_SIZE,
    };
  }
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

function getImageSize(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

function clampCropRect(
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const safeWidth = Number.isFinite(imageWidth) ? imageWidth : 0;
  const safeHeight = Number.isFinite(imageHeight) ? imageHeight : 0;

  if (safeWidth <= 0 || safeHeight <= 0) {
    return { x: 0, y: 0, width: FACE_SIZE, height: FACE_SIZE };
  }

  let originX = Number.isFinite(x) ? x : 0;
  let originY = Number.isFinite(y) ? y : 0;
  let cropWidth = Number.isFinite(width) ? width : safeWidth;
  let cropHeight = Number.isFinite(height) ? height : safeHeight;

  if (cropWidth <= 0 || cropHeight <= 0) {
    return { x: 0, y: 0, width: safeWidth, height: safeHeight };
  }

  originX = Math.max(0, Math.min(originX, safeWidth - 1));
  originY = Math.max(0, Math.min(originY, safeHeight - 1));

  cropWidth = Math.min(cropWidth, safeWidth - originX);
  cropHeight = Math.min(cropHeight, safeHeight - originY);

  const rounded = {
    x: Math.floor(originX),
    y: Math.floor(originY),
    width: Math.max(1, Math.floor(cropWidth)),
    height: Math.max(1, Math.floor(cropHeight)),
  };

  return rounded;
}
