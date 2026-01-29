// Settings Screen
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Input } from "../src/components/ui/Input";
import { Text } from "../src/components/ui/Text";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { Screen } from "../src/ui/layout/Screen";
import { colors, spacing } from "../src/ui";
import {
  getSettings,
  regenerateDeviceId,
  updateAdminPin,
  updateApiBaseUrl,
  updateSyncEnabled,
  updateSyncInterval,
  updateThreshold,
} from "../services/settings";

export default function SettingsScreen() {
  const [threshold, setThreshold] = useState("0.55");
  const [deviceId, setDeviceId] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState("15");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      setThreshold(settings.threshold.toString());
      setApiUrl(settings.api_base_url || "");
      setSyncEnabled(settings.sync_enabled);
      setSyncInterval(settings.sync_interval_minutes.toString());
      setDeviceId(settings.device_id);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load settings");
    }
  };

  const handleSave = async () => {
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0.3 || thresholdNum > 0.8) {
      Alert.alert("Error", "Threshold must be between 0.30 and 0.80");
      return;
    }

    const syncIntervalNum = parseInt(syncInterval, 10);
    if (isNaN(syncIntervalNum) || syncIntervalNum < 1 || syncIntervalNum > 1440) {
      Alert.alert("Error", "Sync interval must be between 1 and 1440 minutes");
      return;
    }

    setSaving(true);
    try {
      await updateThreshold(thresholdNum);
      await updateApiBaseUrl(apiUrl);
      await updateSyncEnabled(syncEnabled);
      await updateSyncInterval(syncIntervalNum);

      Alert.alert("Success", "Settings saved successfully");
    } catch (error: any) {
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (!newPin || !confirmPin) {
      Alert.alert("Error", "Please enter both PIN fields");
      return;
    }

    if (newPin.length < 4) {
      Alert.alert("Error", "PIN must be at least 4 digits");
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert("Error", "PINs do not match");
      return;
    }

    try {
      await updateAdminPin(newPin);
      Alert.alert("Success", "Admin PIN changed successfully");
      setNewPin("");
      setConfirmPin("");
    } catch (error: any) {
      Alert.alert("Error", "Failed to change PIN");
    }
  };

  return (
    <Screen variant="scroll" padding="md" background="default" keyboardSafe>
      <AppHeader
        title="Settings"
        subtitle="Device and attendance"
        showBack
        onBack={() => router.back()}
      />

      <Card>
        <View style={styles.section}>
          <Text variant="Admin/H2">Recognition</Text>
          <Input
            label="Recognition Threshold"
            helperText="Higher values = stricter matching (0.30 - 0.80)"
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="numeric"
            placeholder="0.55"
          />
        </View>
      </Card>

      <Card>
        <View style={styles.section}>
          <Text variant="Admin/H2">Device</Text>
          <Text variant="Admin/Caption" color={colors.text.secondary}>
            Device ID
          </Text>
          <Text variant="Admin/Body" color={colors.brand.primary}>
            {deviceId}
          </Text>
          <Button
            title="Regenerate Device ID"
            onPress={async () => {
              const newId = await regenerateDeviceId();
              setDeviceId(newId);
              Alert.alert("Success", "Device ID regenerated");
            }}
            variant="secondary"
          />
        </View>
      </Card>

      <Card>
        <View style={styles.section}>
          <Text variant="Admin/H2">Sync</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text variant="Admin/Body">Enable Sync</Text>
              <Text variant="Admin/Caption" color={colors.text.secondary}>
                Sync data with backend server
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={setSyncEnabled}
              trackColor={{ false: colors.border, true: colors.brand.primary }}
            />
          </View>
          <Input
            label="API Base URL"
            helperText="Leave empty to disable sync"
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://api.example.com"
            autoCapitalize="none"
            keyboardType="url"
          />
          <Input
            label="Sync Interval (minutes)"
            helperText="How often to sync when enabled (1 - 1440)"
            value={syncInterval}
            onChangeText={setSyncInterval}
            placeholder="15"
            keyboardType="numeric"
          />
        </View>
      </Card>

      <Card>
        <View style={styles.section}>
          <Text variant="Admin/H2">Admin PIN</Text>
          <Input
            label="New PIN"
            value={newPin}
            onChangeText={setNewPin}
            placeholder="Enter new PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
          />
          <Input
            label="Confirm PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            placeholder="Confirm new PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
          />
          <Button
            title="Change PIN"
            onPress={handleChangePin}
            disabled={!newPin || !confirmPin}
            variant="secondary"
          />
        </View>
      </Card>

      <Button
        title="Save Settings"
        onPress={handleSave}
        loading={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
});
