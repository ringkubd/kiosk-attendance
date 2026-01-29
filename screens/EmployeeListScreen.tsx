// Employee List Screen
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  deleteEmployee,
  getAllEmployees,
  updateEmployee,
} from "../db/database";
import { getActiveOrgBranchIds } from "../services/settings";
import type { Employee } from "../types";
import { Button } from "../src/components/ui/Button";
import { Input } from "../src/components/ui/Input";
import { StatusChip } from "../src/components/ui/StatusChip";
import { Text } from "../src/components/ui/Text";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { BottomBar } from "../src/ui/layout/BottomBar";
import { Screen } from "../src/ui/layout/Screen";
import { colors, radii, spacing } from "../src/ui";

export default function EmployeeListScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadEmployees();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
    }, []),
  );

  const loadEmployees = async () => {
    try {
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const data = await getAllEmployees(orgId, branchId);
      setEmployees(data);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (employee: Employee) => {
    Alert.alert(
      "Delete Employee",
      `Are you sure you want to delete ${employee.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEmployee(employee.id);
              loadEmployees();
            } catch (error: any) {
              Alert.alert("Error", "Failed to delete employee");
            }
          },
        },
      ],
    );
  };

  const handleToggleStatus = async (employee: Employee) => {
    const newStatus = employee.status === "active" ? "inactive" : "active";
    try {
      await updateEmployee(employee.id, { status: newStatus });
      loadEmployees();
    } catch (error: any) {
      Alert.alert("Error", "Failed to update employee status");
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      employee.name.toLowerCase().includes(term) ||
      (employee.code || "").toLowerCase().includes(term)
    );
  });

  const renderEmployee = ({ item }: { item: Employee }) => (
    <View style={styles.employeeRow}>
      <View style={styles.employeeInfo}>
        <Text variant="Admin/H2">{item.name}</Text>
        {item.code ? (
          <Text variant="Admin/Caption" color={colors.text.secondary}>
            Code: {item.code}
          </Text>
        ) : null}
      </View>
      <StatusChip
        code={item.status === "active" ? "P" : "A"}
        label={item.status === "active" ? "Active" : "Inactive"}
      />
      <View style={styles.employeeActions}>
        <Button
          title={item.status === "active" ? "Disable" : "Enable"}
          onPress={() => handleToggleStatus(item)}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title="Delete"
          onPress={() => handleDelete(item)}
          variant="danger"
          style={styles.actionButton}
        />
      </View>
    </View>
  );

  return (
    <Screen variant="fixed" padding="md" background="default">
      <AppHeader
        title="Employees"
        subtitle={`Total: ${employees.length}`}
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.content}>
        <Button
          title="Enroll New"
          onPress={() => router.push("/enroll")}
          variant="primary"
        />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or code"
        />
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text variant="Admin/Body">Loading...</Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="Admin/Body">No employees found</Text>
            <Button
              title="Enroll First Employee"
              onPress={() => router.push("/enroll")}
              variant="primary"
            />
          </View>
        ) : (
          <FlatList
            data={filteredEmployees}
            renderItem={renderEmployee}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
      <BottomBar>
        <View style={styles.footer}>
          <Button
            title="Reports"
            onPress={() => router.push("/reports")}
            variant="secondary"
          />
          <Button
            title="Settings"
            onPress={() => router.push("/settings")}
            variant="secondary"
          />
        </View>
      </BottomBar>
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + spacing.xl }]}
        onPress={() => router.push("/enroll")}
      >
        <Text variant="Admin/H2" color={colors.text.inverse}>
          +
        </Text>
      </Pressable>
    </Screen>
  );
}

const FAB_SIZE = spacing.xxl + spacing.sm;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  employeeRow: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  employeeInfo: {
    gap: spacing.xs,
  },
  employeeActions: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  actionButton: {
    width: "100%",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: colors.brand.primary,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
