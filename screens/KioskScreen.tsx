// Kiosk Screen - Main face recognition check-in/out screen
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import
  {
    AppState,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    View,
    type AppStateStatus,
  } from "react-native";
import
  {
    Camera as VisionCamera,
    useCameraDevice,
    useCameraPermission,
  } from "react-native-vision-camera";
import
  {
    Camera as FaceDetectorCamera,
    type Face,
    type FaceDetectionOptions,
  } from "react-native-vision-camera-face-detector";
import { detectFace, type DetectedFace } from "../ml/faceDetection";
import { recognizeFaceWithDetection } from "../ml/faceRecognition";
import
  {
    generateChallenge,
    processLivenessFrame,
    resetLiveness,
  } from "../ml/liveness";
import
  {
    DuplicateAttendanceError,
    logAttendance,
  } from "../services/attendance";
import { getSettings } from "../services/settings";
import
  {
    FaceGuideOverlay,
    ResultCard,
    StatusBanner,
    type KioskStatus,
  } from "../src/components/kiosk";
import { Button } from "../src/components/ui/Button";
import { Text } from "../src/components/ui/Text";
import { colors, radii, spacing } from "../src/ui";
import { CameraOverlayLayout } from "../src/ui/layout/CameraOverlayLayout";
import { Screen } from "../src/ui/layout/Screen";
import type { LivenessChallenge } from "../types";
import { RECOGNITION_THRESHOLD } from "../utils/constants";
import { formatTime } from "../utils/helpers";
import { Logger } from "../utils/logger";

type KioskState = "READY" | "PROCESSING" | "SUCCESS" | "FAIL" | "LIVENESS";

type DisplayResult = {
  employeeName: string;
  confidence: number;
  type: "IN" | "OUT";
  timestamp: number;
};

const logger = new Logger("KioskScreen");

export default function KioskScreen() {
  const [state, setState] = useState<KioskState>("READY");
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [message, setMessage] = useState<string>(
    "Position your face in the frame",
  );
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [processing, setProcessing] = useState(false);
  const [threshold, setThreshold] = useState<number>(RECOGNITION_THRESHOLD);

  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<VisionCamera>(null);
  const isFocused = useIsFocused();
  const processingRef = useRef(false);
  const lastProcessTime = useRef(0);
  const lastFaceUpdate = useRef(0);
  const lastFocusAt = useRef(0);
  const focusInFlight = useRef(false);
  const lastSpoken = useRef<{ msg: string; at: number }>({ msg: "", at: 0 });
  const latestLiveFace = useRef<Face | null>(null);
  const latestLiveFaceAt = useRef(0);
  const [faceBox, setFaceBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const voiceEnabled = true;
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const cameraActive = isFocused && appState === "active";

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState !== "active") {
        setFaceBox(null);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getSettings()
      .then((settings) =>
        setThreshold(settings.threshold || RECOGNITION_THRESHOLD),
      )
      .catch((err) => logger.warn("Failed to load settings", err));
  }, []);

  useEffect(() => {
    if (state === "SUCCESS" || state === "FAIL") {
      const timer = setTimeout(() => {
        setState("READY");
        setResult(null);
        setMessage("Position your face in the frame");
        setChallenge(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const speakMessage = useCallback(
    (text: string) => {
      if (!voiceEnabled || !text) return;
      const now = Date.now();
      if (
        text === lastSpoken.current.msg &&
        now - lastSpoken.current.at < 2500
      ) {
        return;
      }
      lastSpoken.current = { msg: text, at: now };
      Speech.stop();
      Speech.speak(text, { rate: 0.95, pitch: 1.0 });
    },
    [voiceEnabled],
  );

  useEffect(() => {
    if (!voiceEnabled) return;
    if (message.includes("%")) return;
    if (state === "PROCESSING") return;
    if (
      message.toLowerCase().includes("analyzing") ||
      message.toLowerCase().includes("recognizing")
    ) {
      return;
    }
    speakMessage(message);
  }, [message, speakMessage, state, voiceEnabled]);

  const faceDetectionOptions = useMemo<FaceDetectionOptions>(
    () => ({
      performanceMode: "fast",
      landmarkMode: "all",
      classificationMode: "all",
      contourMode: "none",
      minFaceSize: 0.15,
      trackingEnabled: true,
      autoMode: true,
      cameraFacing: "front",
      windowWidth: viewSize.width || 1,
      windowHeight: viewSize.height || 1,
    }),
    [viewSize.height, viewSize.width],
  );

  const extractFaceBox = useCallback((face: Face) => {
    const anyFace = face as any;
    const bounds = anyFace.bounds || anyFace.boundingBox || anyFace.frame;
    if (!bounds) return null;

    if (
      typeof bounds.x === "number" &&
      typeof bounds.y === "number" &&
      typeof bounds.width === "number" &&
      typeof bounds.height === "number"
    ) {
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }

    if (bounds.origin && bounds.size) {
      return {
        x: bounds.origin.x,
        y: bounds.origin.y,
        width: bounds.size.width,
        height: bounds.size.height,
      };
    }

    if (
      typeof bounds.left === "number" &&
      typeof bounds.top === "number" &&
      typeof bounds.right === "number" &&
      typeof bounds.bottom === "number"
    ) {
      return {
        x: bounds.left,
        y: bounds.top,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      };
    }

    return null;
  }, []);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      const now = Date.now();
      if (now - lastFaceUpdate.current < 120) return;
      lastFaceUpdate.current = now;

      if (!faces || faces.length === 0) {
        if (faceBox) setFaceBox(null);
        latestLiveFace.current = null;
        latestLiveFaceAt.current = 0;
        return;
      }

      latestLiveFace.current = faces[0];
      latestLiveFaceAt.current = now;

      const box = extractFaceBox(faces[0]);
      if (!box) return;

      setFaceBox(box);

      const supportsFocus = (device as any)?.supportsFocus;
      if (
        !camera.current ||
        supportsFocus === false ||
        state === "PROCESSING"
      ) {
        return;
      }

      if (focusInFlight.current) return;
      if (now - lastFocusAt.current < 800) return;
      lastFocusAt.current = now;
      focusInFlight.current = true;

      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      const focusX = Math.max(0, Math.min(centerX, viewSize.width));
      const focusY = Math.max(0, Math.min(centerY, viewSize.height));

      Promise.resolve(camera.current.focus({ x: focusX, y: focusY }))
        .catch((err: any) => {
          const msg = err?.message || "";
          if (msg.includes("focus-canceled")) return;
          logger.warn("Auto focus failed", err);
        })
        .finally(() => {
          focusInFlight.current = false;
        });
    },
    [device, extractFaceBox, faceBox, state, viewSize.height, viewSize.width],
  );

  const handleCapture = async () => {
    if (!camera.current || processingRef.current) return;

    const now = Date.now();
    if (now - lastProcessTime.current < 300) return; // throttle
    lastProcessTime.current = now;

    try {
      processingRef.current = true;
      setProcessing(true);
      setState("PROCESSING");
      setMessage("Analyzing face...");

      // Capture base frame (guard for screen focus)
      if (!isFocused) {
        setState("FAIL");
        setMessage("Camera not ready. Please return to the kiosk screen.");
        return;
      }

      const photo = await camera.current.takePhoto({
        flash: "off",
        enableShutterSound: false,
      });

      const faceResult = await detectFace(photo.path, {
        classificationMode: "all",
        landmarkMode: "all",
        performanceMode: "fast",
      });
      if (!faceResult.detected || !faceResult.face) {
        setState("FAIL");
        setMessage(faceResult.reason || "No face detected");
        Vibration.vibrate(200);
        return;
      }
      if (faceResult.faceCount !== 1) {
        setState("FAIL");
        setMessage("Multiple faces detected. Please ensure only one person.");
        Vibration.vibrate(200);
        return;
      }

      // Liveness challenge
      resetLiveness();
      const livenessChallenge = generateChallenge();
      setChallenge(livenessChallenge);
      setState("LIVENESS");
      setMessage(livenessChallenge.instruction);

      // small delay to let camera stabilize after switching focus
      await delay(200);

      let livenessPassed = false;
      const livenessTimeoutMs = 1500;
      const targetFrameIntervalMs = 110; // <=120ms sampling target
      const livenessStart = Date.now();
      let frameIndex = 0;

      while (Date.now() - livenessStart < livenessTimeoutMs) {
        const loopStart = Date.now();
        frameIndex += 1;

        const liveFace = latestLiveFace.current;
        const liveFaceAge = Date.now() - latestLiveFaceAt.current;

        if (liveFace && liveFaceAge <= 220) {
          const detectedFace = mapLiveFaceToDetected(liveFace);
          const { passed, progress } = processLivenessFrame(detectedFace);

          // Update message with progress
          if (progress > 0 && progress < 100) {
            setMessage(
              `${livenessChallenge.instruction} (${Math.round(progress)}%)`,
            );
          }

          if (passed) {
            livenessPassed = true;
            logger.info("Liveness challenge passed");
            break;
          }
        } else {
          // Face lost during challenge
          logger.warn(`Frame ${frameIndex}: Live face not detected`);
        }

        const elapsed = Date.now() - loopStart;
        const remaining = targetFrameIntervalMs - elapsed;
        if (remaining > 0) {
          await delay(remaining);
        }
      }

      if (!livenessPassed) {
        setState("FAIL");
        setMessage("Liveness check failed. Please try again.");
        Vibration.vibrate(200);
        return;
      }

      // Recognize face
      setState("PROCESSING");
      setMessage("Recognizing...");
      const recognition = await recognizeFaceWithDetection(
        photo.path,
        faceResult.face,
        threshold,
      );

      if (!recognition) {
        setState("FAIL");
        setMessage("Face not recognized");
        Vibration.vibrate(200);
        return;
      }

      // Log attendance
      const entry = await logAttendance(
        recognition.employeeId,
        recognition.confidence,
        photo.path,
      );

      setState("SUCCESS");
      setResult({
        employeeName: recognition.employeeName,
        confidence: recognition.confidence,
        type: entry.type,
        timestamp: entry.timestamp,
      });
      setMessage(
        `Welcome ${recognition.employeeName}! ${entry.type} recorded.`,
      );
      Vibration.vibrate([100, 50, 100]);
    } catch (error: any) {
      // Log expected duplicate condition at INFO, otherwise error
      if (error instanceof DuplicateAttendanceError) {
        logger.info("Capture duplicate prevented", error);
      } else {
        logger.error("Capture failed", error);
      }

      // More helpful message for camera runtime errors
      const msg = error?.message || "Recognition failed. Please try again.";
      if (error instanceof DuplicateAttendanceError) {
        setState("SUCCESS");
        setMessage(error.message);
        return;
      }
      if (
        msg.includes("Camera is closed") ||
        msg.includes("CameraRuntimeError")
      ) {
        setState("FAIL");
        setMessage(
          "Camera is not available. Please ensure the app has camera permission and the screen is active.",
        );
      } else {
        setState("FAIL");
        setMessage(msg);
      }
      Vibration.vibrate(200);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const getKioskStatus = (): KioskStatus => {
    switch (state) {
      case "SUCCESS":
        return "SUCCESS";
      case "FAIL":
        return "FAILED";
      case "PROCESSING":
      case "LIVENESS":
        return "SCANNING";
      default:
        return "READY";
    }
  };

  if (!hasPermission) {
    return (
      <Screen variant="fixed" padding="lg" background="default">
        <View style={styles.permissionContainer}>
          <Text variant="Admin/H2">Camera permission required</Text>
          <Button title="Grant Permission" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  if (!device) {
    return (
      <Screen variant="fixed" padding="lg" background="default">
        <View style={styles.permissionContainer}>
          <Text variant="Admin/H2">No camera device found</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      variant="fixed"
      padding="none"
      background="default"
      statusBarStyle="light-content"
      applyInsets={false}
    >
      <View
        style={styles.container}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width !== viewSize.width || height !== viewSize.height) {
            setViewSize({ width, height });
          }
        }}
      >
        <FaceDetectorCamera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraActive}
          photo={true}
          faceDetectionCallback={handleFacesDetected}
          faceDetectionOptions={faceDetectionOptions}
        />

        <CameraOverlayLayout
          topSlot={<StatusBanner status={getKioskStatus()} message={message} />}
          centerSlot={
            faceBox ? (
              <View
                style={[
                  styles.faceTracker,
                  {
                    left: faceBox.x,
                    top: faceBox.y,
                    width: faceBox.width,
                    height: faceBox.height,
                  },
                ]}
              />
            ) : (
              <FaceGuideOverlay />
            )
          }
          bottomSlot={
            <View style={styles.bottomContainer}>
              {result && state === "SUCCESS" ? (
                <ResultCard
                  name={result.employeeName}
                  type={result.type}
                  time={formatTime(result.timestamp)}
                />
              ) : null}

              <TouchableOpacity
                style={[
                  styles.captureButton,
                  processing && styles.captureButtonDisabled,
                ]}
                onPress={handleCapture}
                disabled={processing}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <Button
                title="Admin"
                variant="secondary"
                onPress={() => router.push("/admin-login")}
              />
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const mapLiveFaceToDetected = (face: Face): DetectedFace => ({
  bounds: {
    x: face.bounds.x,
    y: face.bounds.y,
    width: face.bounds.width,
    height: face.bounds.height,
  },
  leftEyeOpenProbability: face.leftEyeOpenProbability,
  rightEyeOpenProbability: face.rightEyeOpenProbability,
  headEulerAngleY: face.yawAngle,
  headEulerAngleZ: face.rollAngle,
  landmarks: face.landmarks
    ? {
        leftEye: face.landmarks.LEFT_EYE
          ? { x: face.landmarks.LEFT_EYE.x, y: face.landmarks.LEFT_EYE.y }
          : undefined,
        rightEye: face.landmarks.RIGHT_EYE
          ? { x: face.landmarks.RIGHT_EYE.x, y: face.landmarks.RIGHT_EYE.y }
          : undefined,
        nose: face.landmarks.NOSE_BASE
          ? { x: face.landmarks.NOSE_BASE.x, y: face.landmarks.NOSE_BASE.y }
          : undefined,
        mouth: face.landmarks.MOUTH_BOTTOM
          ? { x: face.landmarks.MOUTH_BOTTOM.x, y: face.landmarks.MOUTH_BOTTOM.y }
          : undefined,
      }
    : undefined,
});

const CAPTURE_SIZE = 84;
const CAPTURE_INNER_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  bottomContainer: {
    width: "100%",
    alignItems: "center",
    gap: spacing.md,
  },
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    backgroundColor: colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.brand.primary,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: CAPTURE_INNER_SIZE,
    height: CAPTURE_INNER_SIZE,
    borderRadius: CAPTURE_INNER_SIZE / 2,
    backgroundColor: colors.brand.primary,
  },
  faceTracker: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.brand.primary,
    borderRadius: radii.lg,
  },
});
