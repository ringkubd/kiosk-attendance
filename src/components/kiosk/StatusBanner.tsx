import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../ui";
import { Text } from "../ui/Text";

export type KioskStatus = "READY" | "SCANNING" | "SUCCESS" | "FAILED";

interface StatusBannerProps {
  status: KioskStatus;
  message: string;
}

const statusColorMap: Record<KioskStatus, string> = {
  READY: colors.brand.primary,
  SCANNING: colors.brand.primaryLight,
  SUCCESS: colors.status.present,
  FAILED: colors.status.absent,
};

export const StatusBanner = ({ status, message }: StatusBannerProps) => {
  return (
    <View style={[styles.container, { backgroundColor: statusColorMap[status] }]}> 
      <Text variant="Kiosk/Body" color={colors.text.inverse}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    alignItems: "center",
  },
});
