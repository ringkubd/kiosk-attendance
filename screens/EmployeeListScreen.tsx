// Employee List Screen
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import
  {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
  } from "react-native";
import { Button, Card } from "../components/common";
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
  PRIMARY_COLOR,
  SURFACE_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../utils/constants";

export default function EmployeeListScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

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
          <Text
            style={[
              styles.employeeStatus,
              { color: item.status === "active" ? PRIMARY_COLOR : "#757575" },
            ]}
          >
            {item.status === "active" ? "Active" : "Inactive"}
          </Text>
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
        <Text style={styles.title}>Employees ({employees.length})</Text>
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
    padding: 20,
    backgroundColor: SURFACE_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 12,
    fontFamily: "sans-serif-medium",
  },
  enrollButton: {
    marginTop: 8,
  },
  list: {
    padding: 20,
  },
  employeeCard: {
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 4,
    fontFamily: "sans-serif-medium",
  },
  employeeCode: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 4,
    fontFamily: "sans-serif",
  },
  employeeStatus: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "sans-serif-medium",
  },
  employeeActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  toggleButton: {
    backgroundColor: SURFACE_COLOR,
  },
  deleteButton: {
    backgroundColor: ERROR_COLOR,
    borderColor: ERROR_COLOR,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    fontFamily: "sans-serif-medium",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "sans-serif-medium",
  },
  emptyButton: {
    minWidth: 200,
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
});
