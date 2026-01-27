// Helper functions

import { Buffer } from "buffer";

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Cosine similarity
export function cosineSimilarity(
  a: number[] | Float32Array,
  b: number[] | Float32Array,
): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// L2 normalize vector
export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? vector : vector.map((val) => val / norm);
}

// Format date for display
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Format time for display
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

// Check if same day
export function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// Get start of day timestamp
export function getStartOfDay(timeMs: number): number {
  const d = new Date(timeMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Convenience helper for today start
export function getTodayStart(): number {
  return getStartOfDay(Date.now());
}

// Get end of day timestamp
export function getEndOfDay(timeMs: number): number {
  const d = new Date(timeMs);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// Get current timestamp (ms)
export function getCurrentTimestamp(): number {
  return Date.now();
}

// Convert Float32Array to base64
export function float32ArrayToBase64(array: Float32Array): string {
  const buffer = Buffer.from(array.buffer);
  return buffer.toString("base64");
}

// Convert base64 to Float32Array
export function base64ToFloat32Array(base64: string): Float32Array {
  const buffer = Buffer.from(base64, "base64");
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

// Calculate average embedding from multiple samples
export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    throw new Error("No embeddings provided");
  }

  const size = embeddings[0].length;
  const avg = new Float32Array(size);

  for (const embedding of embeddings) {
    for (let i = 0; i < size; i++) {
      avg[i] += embedding[i];
    }
  }

  for (let i = 0; i < size; i++) {
    avg[i] /= embeddings.length;
  }

  return avg;
}
