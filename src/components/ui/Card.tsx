import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../ui";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export const Card = ({ children, style, padding = spacing.lg }: CardProps) => {
  return (
    <View style={[styles.container, { padding }, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    ...shadows.card,
  },
});
