// Root layout
// Import worklets polyfill BEFORE any ONNX imports
import { Stack } from "expo-router";
import { Asset } from "expo-asset";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-worklets";
import { MobileFaceNetModel } from "../assets/modelAssets";
import { initializeApp } from "../services/appInit";
import { BACKGROUND_COLOR, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY } from "../utils/constants";

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      // Ensure model asset is bundled and cached in production.
      await Asset.loadAsync([MobileFaceNetModel]);
      await initializeApp();
      setInitializing(false);
    } catch (err: any) {
      setError(err.message || "Initialization failed");
      setInitializing(false);
    }
  };

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Initializing Kiosk Attendance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorDetails}>{error}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="admin-login" />
          <Stack.Screen name="employees" />
          <Stack.Screen name="enroll" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="device-setup" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

  const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif-medium",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLOR,
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 12,
    fontFamily: "sans-serif-medium",
  },
  errorDetails: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    textAlign: "center",
    fontFamily: "sans-serif",
  },
});
