// Enroll Employee Screen
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import
  {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
  } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import
  {
    Camera,
    useCameraDevice,
    useCameraPermission,
  } from "react-native-vision-camera";
import { Button, Card } from "../components/common";
import { getAllActiveEmployees, insertEmployee } from "../db/database";
import { detectFaces, validateFaceQuality } from "../ml/faceDetection";
import
  {
    initializeModel,
    isModelInitialized,
    runInference,
  } from "../ml/onnxInference";
import { preprocessImage } from "../ml/preprocessor";
import { getActiveOrgBranchIds } from "../services/settings";
import
  {
    BACKGROUND_COLOR,
    BORDER_COLOR,
    ENROLL_DUPLICATE_THRESHOLD,
    PRIMARY_COLOR,
    SUCCESS_COLOR,
    SURFACE_COLOR,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
  } from "../utils/constants";
import
  {
    averageEmbeddings,
    cosineSimilarity,
    generateId,
  } from "../utils/helpers";
import { Logger } from "../utils/logger";

const REQUIRED_SAMPLES = 3;

export default function EnrollEmployeeScreen() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const isFocused = useIsFocused();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height; // Adjust layout when device is wider than tall

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
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const existingEmployees = await getAllActiveEmployees(orgId, branchId);
      for (const employee of existingEmployees) {
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
      for (const sample of samples) {
        if (sample.length !== embedding.length) continue;
        const similarity = cosineSimilarity(embedding, sample);
        if (similarity >= ENROLL_DUPLICATE_THRESHOLD) {
          Alert.alert(
            "Duplicate Sample",
            "This sample is too similar to a previous capture. Please capture a new angle.",
          );
          return;
        }
      }

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
      // Check for duplicate by name or code
      const { orgId, branchId } = await getActiveOrgBranchIds();
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

      // Calculate average embedding
      const avgEmbedding = averageEmbeddings(samples);

      // Create employee
      const employeeId = generateId();
      await insertEmployee({
        id: employeeId,
        org_id: orgId,
        branch_id: branchId,
        name: name.trim(),
        code: code.trim() || undefined,
        embedding_avg: avgEmbedding,
        status: "active",
      });

      Alert.alert("Success", `${name} enrolled successfully!`, [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
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
      <View style={[styles.mainContent, isLandscape && styles.landscape]}>
        <ScrollView
          style={[
            styles.formContainer,
            isLandscape && styles.formContainerLandscape,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard}>
            <Text style={styles.title}>Enroll New Employee</Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Employee Name *"
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Employee Code (optional)"
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
            isLandscape && styles.cameraContainerLandscape,
          ]}
        >
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            photo={true}
          />

          <View style={styles.overlay}>
            <View style={styles.faceBorder} />
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.actionsContainer}>
        <ScrollView
          style={styles.actions}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
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
    padding: 16,
  },
  formCard: {
    padding: 16,
    backgroundColor: SURFACE_COLOR,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_PRIMARY,
    marginBottom: 12,
    fontFamily: "sans-serif-medium",
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
    fontFamily: "sans-serif",
  },
  progressContainer: {
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
    marginBottom: 6,
    fontFamily: "sans-serif-medium",
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
    borderColor: PRIMARY_COLOR,
    borderRadius: 100,
  },
  mainContent: {
    flex: 1,
  },
  landscape: {
    flexDirection: "row",
  },
  formContainerLandscape: {
    flex: 0.5,
    padding: 10,
  },
  cameraContainerLandscape: {
    flex: 0.5,
    minHeight: 200,
    backgroundColor: "#000000",
  },
  actionsContainer: {
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: SURFACE_COLOR,
  },
  captureButton: {
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
  permissionCard: {
    margin: 16,
    alignItems: "center",
  },
  permissionText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "sans-serif-medium",
  },
});
