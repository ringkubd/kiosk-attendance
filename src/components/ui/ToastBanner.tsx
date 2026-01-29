import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../ui";
import { Text } from "./Text";

interface ToastBannerProps {
  message: string;
  tone?: "info" | "success" | "error";
  style?: ViewStyle;
}

const toneMap = {
  info: colors.status.info,
  success: colors.status.present,
  error: colors.status.absent,
} as const;

export const ToastBanner = ({ message, tone = "info", style }: ToastBannerProps) => {
  return (
    <View style={[styles.container, { backgroundColor: toneMap[tone] }, style]}>
      <Text variant="Admin/Body" color={colors.text.inverse}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
});
