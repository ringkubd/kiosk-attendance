import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, spacing, StatusCode, statusColorMap } from "../../ui";
import { Text } from "./Text";

interface StatusChipProps {
  code: StatusCode;
  label?: string;
}

const defaultLabelMap: Record<StatusCode, string> = {
  P: "P",
  A: "A",
  LI: "LI",
  LO: "LO",
  NL: "NL",
  INFO: "INFO",
};

export const StatusChip = ({ code, label }: StatusChipProps) => {
  const backgroundColor = statusColorMap[code];
  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Text variant="Admin/Caption" color={colors.text.inverse}>
        {label ?? defaultLabelMap[code]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: spacing.lg + spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
