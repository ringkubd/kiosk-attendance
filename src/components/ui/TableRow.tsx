import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../ui";
import { Text } from "./Text";
import { StatusChip } from "./StatusChip";
import type { StatusCode } from "../../ui";

interface TableRowProps {
  name: string;
  date: string;
  inOut: string;
  status: StatusCode;
}

export const TableRow = ({ name, date, inOut, status }: TableRowProps) => {
  return (
    <View style={styles.row}>
      <View style={styles.cellWide}>
        <Text variant="Admin/Body">{name}</Text>
      </View>
      <View style={styles.cell}>
        <Text variant="Admin/Caption" color={colors.text.secondary}>
          {date}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text variant="Admin/Caption">{inOut}</Text>
      </View>
      <View style={styles.statusCell}>
        <StatusChip code={status} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: spacing.xxl + spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg.surface,
  },
  cellWide: {
    flex: 2,
  },
  cell: {
    flex: 1,
  },
  statusCell: {
    flex: 1,
    alignItems: "flex-end",
  },
});
