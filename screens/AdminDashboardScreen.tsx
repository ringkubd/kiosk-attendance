// Admin Dashboard Screen
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Text } from "../src/components/ui/Text";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { Screen } from "../src/ui/layout/Screen";
import { colors, radii, spacing } from "../src/ui";

const stats = [
  { label: "Present", value: "128", color: colors.status.present },
  { label: "Late", value: "9", color: colors.status.lateIn },
  { label: "Absent", value: "6", color: colors.status.absent },
  { label: "OT", value: "12", color: colors.status.info },
];

const actions = [
  { label: "Employees" },
  { label: "Shifts" },
  { label: "Reports" },
  { label: "Settings" },
];

export default function AdminDashboardScreen() {
  return (
    <Screen variant="scroll" padding="md" background="default">
      <AppHeader title="Dashboard" subtitle="Today overview" />

      <View style={styles.statsGrid}>
        {stats.map((item) => (
          <Card key={item.label} style={styles.statCard}>
            <Text variant="Admin/Caption" color={colors.text.secondary}>
              {item.label}
            </Text>
            <Text variant="Kiosk/H2" color={item.color}>
              {item.value}
            </Text>
          </Card>
        ))}
      </View>

      <Card>
        <Text variant="Admin/H2">Quick Actions</Text>
        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <Pressable key={action.label} style={styles.actionButton}>
              <Text variant="Admin/Body">{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Button title="View Reports" onPress={() => {}} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    gap: spacing.sm,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexBasis: "48%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.elevated,
    alignItems: "center",
  },
});
