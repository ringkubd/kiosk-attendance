import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../ui";
import { Card } from "../ui/Card";
import { StatusChip } from "../ui/StatusChip";
import { Text } from "../ui/Text";

interface ResultCardProps {
  name: string;
  type: "IN" | "OUT";
  time: string;
  branch?: string;
}

export const ResultCard = ({ name, type, time, branch }: ResultCardProps) => {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="Kiosk/H2">{name}</Text>
        <StatusChip code="INFO" label={type} />
      </View>
      <Text variant="Kiosk/Body" color={colors.text.secondary}>
        {time}
      </Text>
      {branch ? (
        <Text variant="Kiosk/Body" color={colors.text.secondary}>
          {branch}
        </Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 520,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
});
