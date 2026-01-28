// Kiosk Screen - Main face recognition check-in/out screen
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  Camera as FaceDetectorCamera,
  type Face,
  type FaceDetectionOptions,
} from "react-native-vision-camera-face-detector";
import { Button, Card } from "../components/common";
import { detectFace } from "../ml/faceDetection";
import { recognizeFaceWithDetection } from "../ml/faceRecognition";
import {
  generateChallenge,
  processLivenessFrame,
  resetLiveness,
} from "../ml/liveness";
import { DuplicateAttendanceError, logAttendance } from "../services/attendance";
import { getSettings } from "../services/settings";
import type { LivenessChallenge } from "../types";
import {
  ERROR_COLOR,
  PRIMARY_COLOR,
  RECOGNITION_THRESHOLD,
  SUCCESS_COLOR,
  SURFACE_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../utils/constants";
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
  const lastSpoken = useRef<{ msg: string; at: number }>({ msg: "", at: 0 });
  const [faceBox, setFaceBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const voiceEnabled = true;

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

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
        return;
      }

      const box = extractFaceBox(faces[0]);
      if (!box) return;

      setFaceBox(box);

      const supportsFocus = (device as any)?.supportsFocus;
      if (!camera.current || supportsFocus === false || state === "PROCESSING") {
        return;
      }

      if (now - lastFocusAt.current < 800) return;
      lastFocusAt.current = now;

      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      const focusX = Math.max(0, Math.min(centerX, viewSize.width));
      const focusY = Math.max(0, Math.min(centerY, viewSize.height));

      try {
        camera.current.focus({ x: focusX, y: focusY });
      } catch (err) {
        logger.warn("Auto focus failed", err);
      }
    },
    [
      device,
      extractFaceBox,
      faceBox,
      state,
      viewSize.height,
      viewSize.width,
    ],
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
      const maxAttempts = 6; // Faster liveness loop
      const frameDelay = 150; // ms between captures

      for (let i = 0; i < maxAttempts; i++) {
        await delay(frameDelay);

        if (!camera.current) break;

        const frame = await camera.current.takePhoto({
          flash: "off",
          enableShutterSound: false,
        });

        const frameDetection = await detectFace(frame.path, {
          classificationMode: "all",
          landmarkMode: "all",
          performanceMode: "fast",
        });

        if (frameDetection.detected && frameDetection.face) {
          const { passed, progress } = processLivenessFrame(
            frameDetection.face,
          );

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
          logger.warn(`Frame ${i + 1}: Face not detected`);
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

  const getStatusColor = () => {
    switch (state) {
      case "SUCCESS":
        return SUCCESS_COLOR;
      case "FAIL":
        return ERROR_COLOR;
      case "PROCESSING":
      case "LIVENESS":
        return PRIMARY_COLOR;
      default:
        return "#757575";
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== viewSize.width || height !== viewSize.height) {
          setViewSize({ width, height });
        }
      }}
    >
      <StatusBar barStyle="light-content" />
      <FaceDetectorCamera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        photo={true}
        faceDetectionCallback={handleFacesDetected}
        faceDetectionOptions={faceDetectionOptions}
      />

      <View style={styles.overlay}>
        {faceBox ? (
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
          <View style={styles.faceBorder} />
        )}
      </View>

      {/* Status Banner */}
      <View
        style={[styles.statusBanner, { backgroundColor: getStatusColor() }]}
      >
        <Text style={styles.statusText}>{message}</Text>
      </View>

      {/* Result Card */}
      {result && state === "SUCCESS" && (
        <View style={styles.resultContainer}>
          <Card style={styles.resultCard}>
            <Text style={styles.resultName}>{result.employeeName}</Text>
            <Text style={styles.resultType}>{result.type}</Text>
            <Text style={styles.resultTime}>
              {formatTime(result.timestamp)}
            </Text>
            <Text style={styles.resultConfidence}>
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </Text>
          </Card>
        </View>
      )}

      {/* Capture Button */}
      <View style={styles.bottomContainer}>
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

        {/* Admin Access */}
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push("/admin-login")}
        >
          <Text style={styles.adminButtonText}>Admin</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  permissionText: {
    fontSize: 18,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "sans-serif-medium",
  },
  statusBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    zIndex: 10,
    borderRadius: 14,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "sans-serif-medium",
  },
  resultContainer: {
    position: "absolute",
    top: 110,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: SURFACE_COLOR,
    borderRadius: 18,
  },
  resultName: {
    fontSize: 30,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    fontFamily: "sans-serif-medium",
  },
  resultType: {
    fontSize: 24,
    fontWeight: "700",
    color: PRIMARY_COLOR,
    marginBottom: 8,
    fontFamily: "sans-serif-medium",
  },
  resultTime: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    fontFamily: "sans-serif",
  },
  resultConfidence: {
    fontSize: 14,
    color: "#94A3B8",
    fontFamily: "sans-serif",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: SURFACE_COLOR,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: PRIMARY_COLOR,
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY_COLOR,
  },
  adminButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  adminButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontFamily: "sans-serif-medium",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  faceBorder: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
    borderRadius: 130,
  },
  faceTracker: {
    position: "absolute",
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
    borderRadius: 18,
  },
});
