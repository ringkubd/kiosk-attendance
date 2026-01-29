// Admin Login Screen
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Input } from "../src/components/ui/Input";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { Screen } from "../src/ui/layout/Screen";
import { colors, spacing } from "../src/ui";
import { verifyAdminPin } from "../services/settings";

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
    <Screen variant="fixed" padding="sm" background="default" keyboardSafe>
      <AppHeader
        title="Admin Login"
        subtitle="Enter your PIN"
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Input
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            autoFocus
            style={styles.pinInput}
          />

          <Button
            title="Login"
            onPress={handleLogin}
            loading={loading}
            disabled={pin.length < 4}
          />

          <Button
            title="Back to Kiosk"
            onPress={() => router.back()}
            variant="secondary"
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    gap: spacing.md,
    backgroundColor: colors.bg.surface,
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
  },
  pinInput: {
    textAlign: "center",
    letterSpacing: spacing.sm,
  },
});
