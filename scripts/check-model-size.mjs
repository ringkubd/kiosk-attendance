#!/usr/bin/env node
import { existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODEL_PATH = join(
  __dirname,
  "..",
  "assets",
  "models",
  "MobileFaceNet.onnx",
);
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

console.log("🔍 Checking model file size...");
console.log(`Model path: ${MODEL_PATH}`);

if (!existsSync(MODEL_PATH)) {
  console.error("❌ Error: Model file not found!");
  console.error(`   Expected at: ${MODEL_PATH}`);
  console.error(
    "   Please ensure MobileFaceNet.onnx is placed in assets/models/",
  );
  process.exit(1);
}

const stats = statSync(MODEL_PATH);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`📦 Model size: ${sizeMB} MB`);

if (stats.size > MAX_SIZE_BYTES) {
  console.error(`❌ Error: Model file is too large!`);
  console.error(`   Current: ${sizeMB} MB`);
  console.error(`   Maximum: ${MAX_SIZE_MB} MB`);
  console.error("   Please use a smaller model or compress the existing one.");
  process.exit(1);
}

console.log(`✅ Model size check passed (${sizeMB} MB <= ${MAX_SIZE_MB} MB)`);
process.exit(0);
