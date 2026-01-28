// Employee List Screen
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import
  {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
  } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, SectionHeader, StatusBadge } from "../components/common";
import
  {
    deleteEmployee,
    getAllEmployees,
    updateEmployee,
  } from "../db/database";
import { getActiveOrgBranchIds } from "../services/settings";
import type { Employee } from "../types";
import {
  BACKGROUND_COLOR,
  BORDER_COLOR,
  ERROR_COLOR,
  SURFACE_COLOR,
} from "../utils/constants";
import { colors, radii, spacing, typography } from "../ui/theme";

export default function EmployeeListScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderEmployee = ({ item }: { item: Employee }) => (
    <Card style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          {item.code && (
            <Text style={styles.employeeCode}>Code: {item.code}</Text>
          )}
          <StatusBadge
            label={item.status === "active" ? "Active" : "Inactive"}
            tone={item.status === "active" ? "success" : "warning"}
            style={styles.employeeStatusBadge}
          />
        </View>
      </View>

      <View style={styles.employeeActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => handleToggleStatus(item)}
        >
          <Text style={styles.actionButtonText}>
            {item.status === "active" ? "Disable" : "Enable"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionHeader
          title="Employees"
          subtitle={`Total: ${employees.length}`}
          style={styles.headerText}
        />
        <Button
          title="Enroll New"
          onPress={() => router.push("/enroll")}
          style={styles.enrollButton}
        />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No employees enrolled</Text>
          <Button
            title="Enroll First Employee"
            onPress={() => router.push("/enroll")}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          data={employees}
          renderItem={renderEmployee}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <Button
          title="Reports"
          onPress={() => router.push("/reports")}
          variant="secondary"
          style={styles.footerButton}
        />
        <Button
          title="Settings"
          onPress={() => router.push("/settings")}
          variant="secondary"
          style={styles.footerButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: SURFACE_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap", // allow wrapping on narrow portrait screens
  },
  headerText: {
    flex: 1,
    minWidth: 180, // keep title readable on narrow devices
  },
  enrollButton: {
    minWidth: 160,
    alignSelf: "flex-end",
  },
  list: {
    padding: spacing.lg,
  },
  employeeCard: {
    marginBottom: spacing.md,
  },
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  employeeInfo: {
    flex: 1,
    minWidth: 120,
  },
  employeeName: {
    fontSize: typography.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: typography.fontFamilyBold,
  },
  employeeCode: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    fontFamily: typography.fontFamily,
  },
  employeeStatusBadge: {
    marginTop: 4,
  },
  employeeActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap", // wrap buttons to next line on narrow screens
    alignItems: "center",
  },
  actionButton: {
    flex: 1,
    minWidth: 140, // makes actions stack nicely on portrait
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    backgroundColor: colors.surface,
  },
  deleteButton: {
    backgroundColor: ERROR_COLOR,
    borderColor: ERROR_COLOR,
  },
  actionButtonText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyBold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: "center",
    fontFamily: typography.fontFamilyMedium,
  },
  emptyButton: {
    minWidth: 200,
  },
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    gap: spacing.sm,
    flexWrap: "wrap", // allow buttons to stack on portrait
  },
  footerButton: {
    flex: 1,
    minWidth: 140,
  },
});
