// Admin Login Screen
import { router } from "expo-router";
import React, { useState } from "react";
import
  {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    View,
  } from "react-native";
import { Button, Card } from "../components/common";
import { verifyAdminPin } from "../services/settings";
import { BACKGROUND_COLOR, TEXT_PRIMARY, TEXT_SECONDARY } from "../utils/constants";

export default function AdminLoginScreen() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (pin.length < 4) {
      Alert.alert("Error", "Please enter a valid PIN");
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyAdminPin(pin);

      if (isValid) {
        setPin("");
        router.replace("/employees");
      } else {
        Alert.alert("Error", "Invalid PIN");
        setPin("");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Admin Access</Text>
          <Text style={styles.subtitle}>Enter your PIN to continue</Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            autoFocus
          />

          <Button
            title="Login"
            onPress={handleLogin}
            loading={loading}
            disabled={pin.length < 4}
            style={styles.button}
          />

          <Button
            title="Back to Kiosk"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.backButton}
          />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    padding: 24,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "sans-serif-medium",
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginBottom: 32,
    textAlign: "center",
    fontFamily: "sans-serif",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    marginBottom: 24,
    textAlign: "center",
    letterSpacing: 8,
    backgroundColor: "#FFFFFF",
    fontFamily: "sans-serif-medium",
  },
  button: {
    marginBottom: 12,
  },
  backButton: {
    marginTop: 8,
  },
});
