// Shift Management Screen
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Text } from "../src/components/ui/Text";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { Screen } from "../src/ui/layout/Screen";
import { colors, spacing } from "../src/ui";

const shifts = [
  { name: "Morning", time: "09:00 - 17:00", grace: "10 min", ot: "30 min" },
  { name: "Evening", time: "16:00 - 00:00", grace: "10 min", ot: "30 min" },
];

export default function ShiftManagementScreen() {
  return (
    <Screen variant="scroll" padding="md" background="default">
      <AppHeader title="Shifts" subtitle="Manage shift rules" />
      <View style={styles.list}>
        {shifts.map((shift) => (
          <Card key={shift.name}>
            <Text variant="Admin/H2">{shift.name}</Text>
            <Text variant="Admin/Body" color={colors.text.secondary}>
              {shift.time}
            </Text>
            <View style={styles.metaRow}>
              <Text variant="Admin/Caption">Grace: {shift.grace}</Text>
              <Text variant="Admin/Caption">OT: {shift.ot}</Text>
            </View>
            <Button title="Edit" onPress={() => {}} variant="secondary" />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: spacing.sm,
  },
});
