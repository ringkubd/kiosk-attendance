// Device Setup Screen
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { ensureDefaultOrgBranchDevice } from "../db/database";
import
  {
    getActiveOrgBranchIds,
    setActiveOrgBranchIds,
    setDeviceId,
    setDeviceToken,
    updateApiBaseUrl,
  } from "../services/settings";
import { syncService } from "../services/sync";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Input } from "../src/components/ui/Input";
import { Text } from "../src/components/ui/Text";
import { spacing } from "../src/ui";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { Screen } from "../src/ui/layout/Screen";
import { Logger } from "../utils/logger";

const logger = new Logger("DeviceSetup");

interface DeviceRegistrationResponse {
  device_id: string;
  device_token: string;
  business_id?: string;
  org_id?: string;
  branch_id?: string;
}

export default function DeviceSetupScreen() {
  const [registrationCode, setRegistrationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    loadApiUrl();
  }, []);

  const loadApiUrl = async () => {
    try {
      const config = Constants.expoConfig?.extra?.apiBaseUrl;
      if (config) {
        setApiUrl(config);
        logger.info(`✅ Loaded API URL from app.json: ${config}`);
      } else {
        logger.warn("⚠️ API URL not configured in app.json extra.apiBaseUrl");
        setApiUrl("");
      }
    } catch (error) {
      logger.error("Failed to load API URL", error);
      setApiUrl("");
    }
  };

  const handleRegister = async () => {
    if (!registrationCode.trim()) {
      Alert.alert("Error", "Registration code is required.");
      return;
    }

    if (!apiUrl) {
      Alert.alert(
        "Error",
        "API URL not configured. Please set apiBaseUrl in app.json",
      );
      return;
    }

    setSubmitting(true);
    try {
      // Log what's currently stored BEFORE registration
      try {
        const currentIds = await getActiveOrgBranchIds();
        logger.info(
          `[Before Registration] Currently stored org/branch: orgId="${currentIds.orgId}", branchId="${currentIds.branchId}"`,
        );
      } catch (err) {
        logger.info("[Before Registration] No org/branch currently stored");
      }
      const registerUrl = `${apiUrl}/api/v1/attendance/devices/register`;
      logger.info("Registering device with URL:", registerUrl);

      const response = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_code: registrationCode.trim(),
          device_info: {
            model: Constants.deviceName || `${Platform.OS} ${Platform.Version}`,
            os_version: `${Platform.OS} ${Platform.Version}`,
            app_version: Constants.expoConfig?.version || "unknown",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: HTTP ${response.status}`);
      }

      const data = (await response.json()) as DeviceRegistrationResponse;
      logger.info(
        "Registration response received:",
        JSON.stringify(data, null, 2),
      );

      if (!data?.device_id || !data?.device_token) {
        logger.error(
          "Invalid registration response - missing device_id or device_token",
        );
        throw new Error(
          "Server returned invalid response (missing credentials)",
        );
      }

      const businessId = String(data.business_id || data.org_id || "").trim();
      const branchId = String(data.branch_id || "").trim();

      logger.info(
        `Extracted from response: business_id=${data.business_id} (type: ${typeof data.business_id}), org_id=${data.org_id} (type: ${typeof data.org_id}), branch_id=${data.branch_id} (type: ${typeof data.branch_id})`,
      );
      logger.info(
        `String conversion: businessId="${businessId}" (length: ${businessId.length}), branchId="${branchId}" (length: ${branchId.length})`,
      );
      logger.info(
        `After trim() and || fallback: businessId="${businessId}" (truthy: ${!!businessId}), branchId="${branchId}" (truthy: ${!!branchId})`,
      );

      logger.info("Storing credentials to secure storage...");
      await updateApiBaseUrl(apiUrl);
      await setDeviceId(String(data.device_id));
      await setDeviceToken(String(data.device_token));
      logger.info("Device token stored successfully");

      if (businessId && branchId) {
        logger.info(`Storing org/branch: ${businessId}/${branchId}`);

        // Log what was previously stored
        try {
          const prevIds = await getActiveOrgBranchIds();
          logger.debug(
            `[Before Update] Previous org/branch: ${prevIds.orgId}/${prevIds.branchId}`,
          );
        } catch (err) {
          logger.debug("[Before Update] No previous org/branch stored");
        }

        await setActiveOrgBranchIds(businessId, branchId);
        await ensureDefaultOrgBranchDevice(
          businessId,
          branchId,
          String(data.device_id),
        );
        logger.info("Org/branch stored successfully");
      } else {
        logger.warn(
          `SKIPPING org/branch storage: businessId="${businessId}" (${!!businessId}), branchId="${branchId}" (${!!branchId})`,
        );
      }

      // Verify what was stored
      const { orgId: storedOrgId, branchId: storedBranchId } =
        await getActiveOrgBranchIds();
      logger.info(
        `[Verification] Stored org/branch: orgId="${storedOrgId}", branchId="${storedBranchId}"`,
      );

      logger.info("Device registered successfully. Triggering sync...");
      const syncResult = await syncService.performSync();
      logger.info(
        `Sync completed: ${syncResult.syncedLogs} logs, ${syncResult.pulledEmployees} employees`,
      );

      Alert.alert("Success", "Device registered and synced successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      logger.error("Device registration failed:", error);
      Alert.alert(
        "Registration Failed",
        error?.message || "Unable to register device",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen variant="scroll" padding="md" background="default" keyboardSafe>
      <AppHeader
        title="Device Setup"
        subtitle="Register this kiosk"
        showBack
        onBack={() => router.back()}
      />

      <Card>
        <View style={styles.section}>
          <Text variant="Admin/H2">Registration</Text>
          {apiUrl && (
            <View>
              <Text variant="Admin/Caption" style={styles.label}>
                API Server
              </Text>
              <Text variant="Admin/Body" style={styles.apiUrl}>
                {apiUrl}
              </Text>
            </View>
          )}
          <Input
            label="Registration Code"
            helperText="Provided by the admin panel"
            value={registrationCode}
            onChangeText={setRegistrationCode}
            placeholder="REG-XXXX"
            autoCapitalize="characters"
          />
          <Button
            title="Register Device"
            onPress={handleRegister}
            loading={submitting}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  apiUrl: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
});
