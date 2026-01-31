// Employee List Screen
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import
  {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
  } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import
  {
    deleteEmployee,
    getAllEmployeesUnfiltered,
    updateEmployee,
  } from "../db/database";
import { getActiveOrgBranchIds } from "../services/settings";
import { Button } from "../src/components/ui/Button";
import { Card } from "../src/components/ui/Card";
import { Input } from "../src/components/ui/Input";
import { StatusChip } from "../src/components/ui/StatusChip";
import { Text } from "../src/components/ui/Text";
import { colors, spacing } from "../src/ui";
import { AppHeader } from "../src/ui/layout/AppHeader";
import { BottomBar } from "../src/ui/layout/BottomBar";
import { Screen } from "../src/ui/layout/Screen";
import type { Employee } from "../types";
import { Logger } from "../utils/logger";
import { syncEventEmitter } from "../utils/syncEventEmitter";

const logger = new Logger("EmployeeList");

export default function EmployeeListScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadEmployees();

    // Listen for sync events for automatic refresh
    const unsubscribeEmployeeSync = syncEventEmitter.onEmployeesSynced(
      (count) => {
        logger.info(
          `[Event] Employees synced event received (${count}), refreshing list...`,
        );
        loadEmployees();
      },
    );

    return () => {
      logger.debug("[Event] Unsubscribing from employee sync events");
      unsubscribeEmployeeSync();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      logger.info("Screen focused, reloading employees...");
      loadEmployees();
    }, []),
  );

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const { orgId, branchId } = await getActiveOrgBranchIds();
      logger.debug(
        `[Load] Query context: orgId="${orgId}" (type: ${typeof orgId}), branchId="${branchId}" (type: ${typeof branchId})`,
      );
      const data = await getAllEmployeesUnfiltered();
      logger.info(
        `[Load] ✅ Loaded ${data.length} employees from database (unfiltered list)`,
      );
      if (data.length === 0) {
        logger.warn(
          `[Load] ⚠️ No employees found - possible sync not yet completed`,
        );
      }
      setEmployees(data);
    } catch (error: any) {
      logger.error("[Load] Failed to load employees", error);
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

  const renderEmployee = ({ item }: { item: Employee }) => {
    const hasFace =
      Boolean(item.embeddings_json) ||
      (item.embedding_avg ? item.embedding_avg.length > 0 : false);

    return (
      <Card style={styles.employeeCard}>
        <View style={styles.cardContent}>
          {/* Left: Avatar & Info */}
          <View style={styles.leftSection}>
            <View style={styles.avatar}>
              <Text variant="Admin/H3" color={colors.text.inverse}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoSection}>
              <Text variant="Admin/Body" style={styles.employeeName}>
                {item.name}
              </Text>
              {item.code && (
                <Text variant="Admin/Caption" color={colors.text.secondary}>
                  Code: {item.code}
                </Text>
              )}
            </View>
          </View>

          {/* Right: Status & Actions */}
          <View style={styles.rightSection}>
            <StatusChip
              code={item.status === "active" ? "P" : "A"}
              label={item.status === "active" ? "Active" : "Inactive"}
            />
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  router.push({
                    pathname: "/enroll",
                    params: { employeeId: item.id },
                  })
                }
              >
                <Text variant="Admin/Body" color={colors.brand.primary}>
                  {hasFace ? "🔄" : "📸"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleToggleStatus(item)}
              >
                <Text variant="Admin/Body" color={colors.text.secondary}>
                  {item.status === "active" ? "⏸️" : "▶️"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDelete(item)}
              >
                <Text variant="Admin/Body" color={colors.status.absent}>
                  🗑️
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <Screen variant="fixed" padding="md" background="default">
      <AppHeader
        title="Employees"
        subtitle={`Total: ${employees.length}`}
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.content}>
        {/* <Button
          title="+ Enroll New Employee"
          onPress={() => router.push("/enroll")}
          variant="primary"
        /> */}
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or code..."
        />
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text variant="Admin/Body" color={colors.text.secondary}>
              Loading employees...
            </Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="Admin/H3" color={colors.text.primary}>
              No employees found
            </Text>
            <Text variant="Admin/Body" color={colors.text.secondary}>
              {search
                ? "Try a different search term"
                : "Get started by enrolling your first employee"}
            </Text>
            {!search && (
              <Button
                title="Enroll First Employee"
                onPress={() => router.push("/enroll")}
                variant="primary"
                style={{ marginTop: spacing.md }}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={filteredEmployees}
            renderItem={renderEmployee}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
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
  listContainer: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  employeeCard: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  employeeName: {
    fontWeight: "600",
  },
  rightSection: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
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
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
