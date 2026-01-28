// Settings Screen
import React, { useEffect, useState } from "react";
import
  {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
  } from "react-native";
import { Button, Card } from "../components/common";
import {
  getSettings,
  regenerateDeviceId,
  updateAdminPin,
  updateApiBaseUrl,
  updateSyncEnabled,
  updateSyncInterval,
  updateThreshold,
} from "../services/settings";
import {
  BACKGROUND_COLOR,
  BORDER_COLOR,
  PRIMARY_COLOR,
  SURFACE_COLOR,
} from "../utils/constants";
import { colors, radii, spacing, typography } from "../ui/theme";

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
    // Validate threshold
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0.3 || thresholdNum > 0.8) {
      Alert.alert("Error", "Threshold must be between 0.30 and 0.80");
      return;
    }

    const syncIntervalNum = parseInt(syncInterval, 10);
    if (
      isNaN(syncIntervalNum) ||
      syncIntervalNum < 1 ||
      syncIntervalNum > 1440
    ) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Recognition Settings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Recognition Settings</Text>

        <View style={styles.setting}>
          <Text style={styles.label}>Recognition Threshold</Text>
          <Text style={styles.hint}>
            Higher values = stricter matching (0.30 - 0.80)
          </Text>
          <TextInput
            style={styles.input}
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="numeric"
            placeholder="0.55"
          />
        </View>
      </Card>

      {/* Device Settings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Device Settings</Text>

        <View style={styles.setting}>
          <Text style={styles.label}>Device ID</Text>
          <Text style={styles.hint}>Unique identifier for this device</Text>
          <Text style={styles.deviceId}>{deviceId}</Text>
        </View>

        <Button
          title="Regenerate Device ID"
          onPress={async () => {
            const newId = await regenerateDeviceId();
            setDeviceId(newId);
            Alert.alert("Success", "Device ID regenerated");
          }}
          variant="secondary"
          style={styles.regenerateButton}
        />
      </Card>

      {/* Sync Settings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Settings</Text>

        <View style={styles.setting}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Enable Sync</Text>
              <Text style={styles.hint}>Sync data with backend server</Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={setSyncEnabled}
              trackColor={{ false: "#E0E0E0", true: PRIMARY_COLOR }}
            />
          </View>
        </View>

        <View style={styles.setting}>
          <Text style={styles.label}>API Base URL</Text>
          <Text style={styles.hint}>Leave empty to disable sync</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://api.example.com"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.label}>Sync Interval (minutes)</Text>
          <Text style={styles.hint}>
            How often to sync when enabled (1 - 1440)
          </Text>
          <TextInput
            style={styles.input}
            value={syncInterval}
            onChangeText={setSyncInterval}
            placeholder="15"
            keyboardType="numeric"
          />
        </View>
      </Card>

      {/* Admin PIN */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Admin PIN</Text>

        <View style={styles.setting}>
          <Text style={styles.label}>New PIN</Text>
          <TextInput
            style={styles.input}
            value={newPin}
            onChangeText={setNewPin}
            placeholder="Enter new PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            style={styles.input}
            value={confirmPin}
            onChangeText={setConfirmPin}
            placeholder="Confirm new PIN"
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
          />
        </View>

        <Button
          title="Change PIN"
          onPress={handleChangePin}
          disabled={!newPin || !confirmPin}
          variant="secondary"
          style={styles.changePinButton}
        />
      </Card>

      {/* Save Button */}
      <Button
        title="Save Settings"
        onPress={handleSave}
        loading={saving}
        style={styles.saveButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: SURFACE_COLOR,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontFamily: typography.fontFamilyBold,
  },
  setting: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: typography.fontFamilyMedium,
  },
  hint: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamily,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    backgroundColor: SURFACE_COLOR,
    fontFamily: typography.fontFamily,
  },
  deviceId: {
    fontSize: typography.caption,
    color: colors.primary,
    fontFamily: "monospace",
    backgroundColor: BACKGROUND_COLOR,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  changePinButton: {
    marginTop: spacing.sm,
  },
  regenerateButton: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginBottom: spacing.xxl,
  },
});
