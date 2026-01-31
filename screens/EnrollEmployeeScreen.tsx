// Enroll Employee Screen
import { useIsFocused } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import
  {
    Alert,
    AppState,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type AppStateStatus,
  } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { Button, Card, SectionHeader } from "../components/common";
import {
  getAllActiveEmployees,
  getEmployeeById,
  insertEmployee,
  updateEmployee,
} from "../db/database";
import { detectFaces, validateFaceQuality } from "../ml/faceDetection";
import
  {
    initializeModel,
    isModelInitialized,
    runInference,
  } from "../ml/onnxInference";
import { preprocessImage } from "../ml/preprocessor";
import { getActiveOrgBranchIds, getSettings } from "../services/settings";
import { syncService } from "../services/sync";
import type { Employee } from "../types";
import { colors, radii, spacing, typography } from "../ui/theme";
import
  {
    BACKGROUND_COLOR,
    BORDER_COLOR,
    ENROLL_DUPLICATE_THRESHOLD,
    PRIMARY_COLOR,
    SUCCESS_COLOR,
    SURFACE_COLOR,
  } from "../utils/constants";
import
  {
    averageEmbeddings,
    cosineSimilarity,
    float32ArrayToBase64,
    generateId,
  } from "../utils/helpers";
import { Logger } from "../utils/logger";
import { encryptEmbeddingsPayload } from "../utils/encryption";

const REQUIRED_SAMPLES = 3;

export default function EnrollEmployeeScreen() {
  const params = useLocalSearchParams<{ employeeId?: string }>();
  const employeeIdParam =
    typeof params.employeeId === "string" ? params.employeeId : undefined;
  const [existingEmployee, setExistingEmployee] = useState<Employee | null>(
    null,
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<VisionCamera>(null);
  const isFocused = useIsFocused();
  const lastFaceUpdate = useRef(0);
  const lastFocusAt = useRef(0);
  const focusInFlight = useRef(false);
  const [faceBox, setFaceBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.max(width, height) >= 900;
  const isLandscapeLayout = isLandscape && isTablet;
  const cameraActive = isFocused && appState === "active";

  useEffect(() => {
    if (!employeeIdParam) return;
    let mounted = true;
    (async () => {
      const employee = await getEmployeeById(employeeIdParam);
      if (!employee) {
        Alert.alert("Error", "Employee not found");
        router.back();
        return;
      }
      if (!mounted) return;
      setExistingEmployee(employee);
      setName(employee.name);
      setCode(employee.code || "");
    })().catch((error) => {
      Logger.error("Failed to load employee for enrollment", error);
    });
    return () => {
      mounted = false;
    };
  }, [employeeIdParam]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState !== "active") {
        setFaceBox(null);
      }
    });
    return () => sub.remove();
  }, []);

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
      if (!camera.current || supportsFocus === false || capturing) {
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
          Logger.warn("Auto focus failed", err);
        })
        .finally(() => {
          focusInFlight.current = false;
        });
    },
    [
      capturing,
      device,
      extractFaceBox,
      faceBox,
      viewSize.height,
      viewSize.width,
    ],
  );

  const handleCaptureSample = async () => {
    if (!camera.current || capturing) return;
    if (!isFocused) {
      Alert.alert(
        "Camera not ready",
        "Please make sure the screen is active before capturing.",
      );
      return;
    }
    if (!name.trim()) {
      Alert.alert("Error", "Please enter employee name");
      return;
    }

    setCapturing(true);
    try {
      // extra guard: ensure camera is active
      if (!isFocused) throw new Error("Camera is not active");
      // small delay to allow camera to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200));
      const photo = await camera.current.takePhoto({
        flash: "off",
        enableShutterSound: false,
      });

      // Detect faces
      const faces = await detectFaces(photo.path);

      if (!faces || faces.length === 0) {
        Alert.alert("Error", "No face detected");
        setCapturing(false);
        return;
      }

      if (faces.length !== 1) {
        Alert.alert(
          "Error",
          "Multiple faces detected. Please ensure only one person.",
        );
        setCapturing(false);
        return;
      }

      const face = faces[0];

      // Quality gate
      const quality = validateFaceQuality(face);
      if (!quality.valid) {
        Alert.alert("Error", quality.reason || "Face quality insufficient");
        setCapturing(false);
        return;
      }

      // Ensure model is ready
      if (!isModelInitialized()) {
        await initializeModel();
      }

      // Preprocess image using detected bounds
      const inputTensor = await preprocessImage(photo.path, face.bounds);

      // Run inference
      const embedding = await runInference(inputTensor);

      // Duplicate check: already enrolled employees
      const { orgId, branchId } = existingEmployee
        ? {
            orgId: existingEmployee.org_id,
            branchId: existingEmployee.branch_id,
          }
        : await getActiveOrgBranchIds();
      const existingEmployees = await getAllActiveEmployees(orgId, branchId);
      for (const employee of existingEmployees) {
        if (employeeIdParam && employee.id === employeeIdParam) continue;
        if (!employee.embedding_avg) continue;
        if (employee.embedding_avg.length !== embedding.length) continue;
        const similarity = cosineSimilarity(embedding, employee.embedding_avg);
        if (similarity >= ENROLL_DUPLICATE_THRESHOLD) {
          Alert.alert(
            "Duplicate Face Detected",
            `This face appears to match an existing employee (${employee.name}).`,
          );
          return;
        }
      }

      // Duplicate check: captured samples for this enrollment
      // for (const sample of samples) {
      //   if (sample.length !== embedding.length) continue;
      //   const similarity = cosineSimilarity(embedding, sample);
      //   if (similarity >= ENROLL_DUPLICATE_THRESHOLD) {
      //     Alert.alert(
      //       "Duplicate Sample",
      //       "This sample is too similar to a previous capture. Please capture a new angle.",
      //     );
      //     return;
      //   }
      // }

      // Add to samples
      setSamples((prev) => [...prev, embedding]);

      if (samples.length + 1 >= REQUIRED_SAMPLES) {
        Alert.alert(
          "Success",
          `Captured ${samples.length + 1}/${REQUIRED_SAMPLES} samples. Ready to save!`,
        );
      }
    } catch (error: any) {
      Logger.error("Sample capture failed:", error);
      // Provide helpful UI message for camera closed/runtime errors
      const msg =
        error?.message || "Failed to capture sample. Please try again.";
      if (
        msg.includes("Camera is closed") ||
        msg.includes("CameraRuntimeError")
      ) {
        Alert.alert(
          "Camera Error",
          "Camera is not available. Please return to the previous screen and try again.",
        );
      } else {
        Alert.alert("Error", "Failed to capture sample. Please try again.");
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleSave = async () => {
    if (employeeIdParam && !existingEmployee) {
      Alert.alert("Error", "Employee data not loaded yet");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Error", "Please enter employee name");
      return;
    }

    if (samples.length < REQUIRED_SAMPLES) {
      Alert.alert("Error", `Please capture ${REQUIRED_SAMPLES} samples`);
      return;
    }

    setSaving(true);
    try {
      let orgId: string;
      let branchId: string;
      if (existingEmployee) {
        orgId = existingEmployee.org_id;
        branchId = existingEmployee.branch_id;
      } else {
        const context = await getActiveOrgBranchIds();
        orgId = context.orgId;
        branchId = context.branchId;
      }

      // Calculate average embedding
      const avgEmbedding = averageEmbeddings(samples);

      // Create or update employee
      const employeeId = existingEmployee?.id || generateId();
      const embeddingsBase64 = float32ArrayToBase64(avgEmbedding);
      if (existingEmployee) {
        await updateEmployee(employeeId, {
          embedding_avg: avgEmbedding,
          embeddings_json: embeddingsBase64,
        });
      } else {
        // Check for duplicate by name or code
        const existingEmployees = await getAllActiveEmployees(orgId, branchId);
        const trimmedName = name.trim().toLowerCase();
        const trimmedCode = code.trim();

        for (const emp of existingEmployees) {
          if (emp.name.toLowerCase() === trimmedName) {
            Alert.alert(
              "Duplicate Name",
              `An employee named "${name}" already exists.`,
            );
            setSaving(false);
            return;
          }
          if (
            trimmedCode &&
            emp.code?.toLowerCase() === trimmedCode.toLowerCase()
          ) {
            Alert.alert(
              "Duplicate Code",
              `An employee with code "${code}" already exists.`,
            );
            setSaving(false);
            return;
          }
        }

        await insertEmployee({
          id: employeeId,
          org_id: orgId,
          branch_id: branchId,
          name: name.trim(),
          code: code.trim() || undefined,
          embedding_avg: avgEmbedding,
          embeddings_json: embeddingsBase64,
          status: "active",
        });
      }

      let syncWarning: string | null = null;
      try {
        const settings = await getSettings();
        if (settings.sync_enabled && settings.api_base_url) {
          const encrypted = await encryptEmbeddingsPayload(
            embeddingsBase64,
            settings.device_token || null,
          );
          await syncService.pushFaceEnrollment(
            settings.api_base_url,
            employeeId,
            encrypted,
          );
        }
      } catch (syncError: any) {
        syncWarning = "Face data saved locally but failed to sync.";
        Logger.warn("Face enrollment sync failed", syncError);
      }

      const successName = existingEmployee ? existingEmployee.name : name;
      Alert.alert(
        "Success",
        `${successName} enrolled successfully!${syncWarning ? `\n\n${syncWarning}` : ""}`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      Logger.error("Employee enrollment failed:", error);
      Alert.alert("Error", "Failed to enroll employee. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Samples",
      "Are you sure you want to clear all captured samples?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => setSamples([]),
        },
      ],
    );
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Card style={styles.permissionCard}>
          <Text style={styles.permissionText}>Camera permission required</Text>
          <Button title="Grant Permission" onPress={requestPermission} />
        </Card>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.mainContent, isLandscapeLayout && styles.landscape]}>
        <ScrollView
          style={[
            styles.formContainer,
            isLandscapeLayout && styles.formContainerLandscape,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard}>
            <SectionHeader
              title={
                existingEmployee ? "Enroll Face Data" : "Enroll New Employee"
              }
            />
            {existingEmployee ? (
              <Text style={styles.helperText}>
                {existingEmployee.embeddings_json ||
                (existingEmployee.embedding_avg &&
                  existingEmployee.embedding_avg.length > 0)
                  ? "This will replace existing face data."
                  : "No face data found. Capture samples to enroll."}
              </Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Employee Name *"
              autoCapitalize="words"
              editable={!existingEmployee}
            />

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Employee Code (optional)"
              editable={!existingEmployee}
            />

            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Samples: {samples.length}/{REQUIRED_SAMPLES}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(samples.length / REQUIRED_SAMPLES) * 100}%`,
                      backgroundColor:
                        samples.length >= REQUIRED_SAMPLES
                          ? SUCCESS_COLOR
                          : PRIMARY_COLOR,
                    },
                  ]}
                />
              </View>
            </View>
          </Card>
        </ScrollView>

        <View
          style={[
            styles.cameraContainer,
            isLandscapeLayout && styles.cameraContainerLandscape,
            !isLandscapeLayout && {
              height: Math.round(Math.min(360, height * 0.45)),
            },
          ]}
          onLayout={(event) => {
            const { width: layoutWidth, height: layoutHeight } =
              event.nativeEvent.layout;
            if (
              layoutWidth !== viewSize.width ||
              layoutHeight !== viewSize.height
            ) {
              setViewSize({ width: layoutWidth, height: layoutHeight });
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
              <View
                style={[
                  styles.faceBorder,
                  !isLandscapeLayout && styles.faceBorderPortrait,
                ]}
              />
            )}
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.actionsContainer}>
        <View style={styles.actions}>
          <Button
            title="Capture Sample"
            onPress={handleCaptureSample}
            loading={capturing}
            disabled={capturing || samples.length >= REQUIRED_SAMPLES}
            style={styles.captureButton}
          />

          {samples.length > 0 && (
            <View style={styles.actionRow}>
              <Button
                title="Reset"
                onPress={handleReset}
                variant="secondary"
                style={styles.resetButton}
              />
              <Button
                title="Save Employee"
                onPress={handleSave}
                loading={saving}
                disabled={samples.length < REQUIRED_SAMPLES || saving}
                style={styles.saveButton}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  formContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  formCard: {
    padding: spacing.lg,
    backgroundColor: SURFACE_COLOR,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    marginBottom: spacing.sm,
    backgroundColor: "#FAFAFA",
    fontFamily: typography.fontFamily,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressText: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamilyMedium,
  },
  progressBar: {
    height: 6,
    backgroundColor: BORDER_COLOR,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  cameraContainer: {
    flex: 1,
    minHeight: 150,
    backgroundColor: "#000000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  faceBorder: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 100,
  },
  faceBorderPortrait: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  faceTracker: {
    position: "absolute",
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
    borderRadius: 14,
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
  },
  landscape: {
    flexDirection: "row",
  },
  formContainerLandscape: {
    flex: 0.5,
    // padding: 10,
  },
  cameraContainerLandscape: {
    flex: 0.5,
    height: 200,
    backgroundColor: "#000000",
  },
  actionsContainer: {
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    paddingBottom: spacing.sm,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: SURFACE_COLOR,
  },
  captureButton: {
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    // marginTop: 8,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
  permissionCard: {
    margin: spacing.lg,
    alignItems: "center",
  },
  permissionText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
    fontFamily: typography.fontFamilyMedium,
  },
  helperText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamilyMedium,
  },
});
