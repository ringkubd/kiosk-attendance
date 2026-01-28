// ONNX Inference for MobileFaceNet
import { Asset } from "expo-asset";
import { MODEL_INPUT_SHAPE } from "../utils/constants";
import { l2Normalize } from "../utils/helpers";
import { Logger } from "../utils/logger";

let session: any = null;
let ort: any = null;

export async function initializeModel(): Promise<void> {
  try {
    Logger.info("Loading MobileFaceNet ONNX model...");

    // Dynamically import ONNX runtime to avoid top-level native calls during bundling
    try {
      ort = await import("onnxruntime-react-native");
      Logger.debug("ONNX runtime loaded successfully");
    } catch (e: any) {
      Logger.error("onnxruntime-react-native not available:", e.message || e);
      throw new Error(
        "onnxruntime-react-native is not available in this build. Make sure you are running a native build with the ONNX Runtime native module installed.",
      );
    }

    // Load model asset - use try-catch for better error reporting
    let asset: any;
    try {
      asset = Asset.fromModule(
        require("../../assets/models/MobileFaceNet.onnx"),
      );
      Logger.debug("Model asset created");
    } catch (e: any) {
      Logger.error("Failed to load model asset:", e.message || e);
      throw new Error(`Model asset not found: ${e.message}`);
    }

    Logger.debug(`Asset URI before download: ${asset.uri}`);
    await asset.downloadAsync();
    Logger.debug(`Asset local URI: ${asset.localUri}`);

    if (!asset.localUri) {
      throw new Error("Failed to get local URI for model asset after download");
    }

    // Create session using dynamic import
    if (!ort || !ort.InferenceSession) {
      throw new Error("ONNX runtime InferenceSession not found");
    }

    Logger.info(`Creating ONNX session from: ${asset.localUri}`);
    session = await ort.InferenceSession.create(asset.localUri);
    Logger.info("Model loaded successfully");
    Logger.debug(`Input names: ${session.inputNames}, Output names: ${session.outputNames}`);
  } catch (error: any) {
    Logger.error("Failed to load ONNX model:", error);
    throw new Error(`Model initialization failed: ${error.message}`);
  }
}

export async function runInference(
  inputTensor: Float32Array,
): Promise<Float32Array> {
  if (!session) {
    throw new Error("Model not initialized. Call initializeModel() first.");
  }

  try {
    Logger.debug(`Input tensor size: ${inputTensor.length}, expected: ${MODEL_INPUT_SHAPE.reduce((a, b) => a * b, 1)}`);

    // Validate input tensor size
    const expectedSize = MODEL_INPUT_SHAPE.reduce((a, b) => a * b, 1);
    if (inputTensor.length !== expectedSize) {
      throw new Error(`Input tensor size mismatch: got ${inputTensor.length}, expected ${expectedSize}`);
    }

    // Create input tensor with shape [1, 3, 112, 112]
    const tensor = new ort.Tensor("float32", inputTensor, MODEL_INPUT_SHAPE);

    // Run inference using model-reported input/output names
    const inputName = session.inputNames?.[0] || "input";
    const outputName = session.outputNames?.[0];

    Logger.debug(`Running inference with input: ${inputName}, output: ${outputName}`);

    const results = await session.run({ [inputName]: tensor });

    // Get output tensor (embedding)
    const outputTensor = results[outputName];
    if (!outputTensor) {
      throw new Error(`No output tensor found for name: ${outputName}`);
    }

    const embedding = outputTensor.data as Float32Array;
    if (!embedding || embedding.length === 0) {
      throw new Error(`Invalid embedding output: empty or undefined`);
    }

    Logger.debug(`Embedding size: ${embedding.length}`);

    // L2 normalize the embedding
    const normalized = l2Normalize(Array.from(embedding));

    return new Float32Array(normalized);
  } catch (error: any) {
    Logger.error("Inference failed:", error);
    throw new Error(`Inference failed: ${error.message}`);
  }
}

export function isModelInitialized(): boolean {
  return session !== null;
}

export async function cleanupModel(): Promise<void> {
  if (session) {
    // ONNX Runtime React Native doesn't have explicit cleanup
    session = null;
    Logger.info("Model session cleaned up");
  }
}
