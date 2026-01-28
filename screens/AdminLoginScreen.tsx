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
import { BACKGROUND_COLOR } from "../utils/constants";
import { colors, radii, spacing, typography } from "../ui/theme";

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
    padding: spacing.xl,
    borderRadius: radii.xl,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
    fontFamily: typography.fontFamilyBold,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
    textAlign: "center",
    fontFamily: typography.fontFamily,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(30, 136, 229, 0.25)",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.bodyLarge,
    marginBottom: spacing.xl,
    textAlign: "center",
    letterSpacing: 8,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamilyMedium,
  },
  button: {
    marginBottom: 12,
  },
  backButton: {
    marginTop: 8,
  },
});
