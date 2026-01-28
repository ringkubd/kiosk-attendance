// Reports Screen
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import
  {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
  } from "react-native";
import { Button } from "../components/common";
import { ScrollableTable } from "../components/ScrollableTable";
import
  {
    getAllEmployees,
    getAttendanceLogsWithEmployeeByDateRange,
  } from "../db/database";
import { getActiveOrgBranchIds } from "../services/settings";
import type { AttendanceLogWithEmployee } from "../types";
import
  {
    BACKGROUND_COLOR,
    BORDER_COLOR,
    PRIMARY_COLOR,
    SECONDARY_COLOR,
    SURFACE_COLOR,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
  } from "../utils/constants";
import { formatDate, formatTime, getTodayStart } from "../utils/helpers";

type DateFilter = "today" | "week" | "month" | "all";

export default function ReportsScreen() {
  const [logs, setLogs] = useState<AttendanceLogWithEmployee[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [filter, setFilter] = useState<DateFilter>("today");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);


  const getRange = () => {
    const endTime = Date.now();
    let startTime = 0;
    switch (filter) {
      case "today":
        startTime = getTodayStart();
        break;
      case "week":
        startTime = endTime - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = endTime - 30 * 24 * 60 * 60 * 1000;
        break;
      case "all":
        startTime = 0;
        break;
    }
    return { startTime, endTime };
  };

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const endTime = Date.now();
      let startTime = 0;
      switch (filter) {
        case "today":
          startTime = getTodayStart();
          break;
        case "week":
          startTime = endTime - 7 * 24 * 60 * 60 * 1000;
          break;
        case "month":
          startTime = endTime - 30 * 24 * 60 * 60 * 1000;
          break;
        case "all":
          startTime = 0;
          break;
      }
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const data = await getAttendanceLogsWithEmployeeByDateRange(
        orgId,
        branchId,
        startTime,
        endTime,
      );
      setLogs(data);
      const employeeRows = await getAllEmployees(orgId, branchId);
      setEmployees(employeeRows.map((e) => ({ id: e.id, name: e.name })));
    } catch (err: any) {
      console.warn("Failed to load attendance logs", err);
      Alert.alert("Error", "Failed to load attendance logs");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const handleExportCSV = async () => {
    if (logs.length === 0) {
      Alert.alert("No Data", "No logs to export");
      return;
    }

    setExporting(true);
    try {
      const { startTime, endTime } = getRange();
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const employees = await getAllEmployees(orgId, branchId);
      const targetEmployees =
        employeeFilter === "all"
          ? employees
          : employees.filter((e) => e.id === employeeFilter);

      const toDateKey = (ts: number) => {
        const d = new Date(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      let csvContent = "";

      if (filter === "month") {
        // Monthly report with daily rows + summary
        const dayKeys: string[] = [];
        const cursor = new Date(startTime);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(endTime);
        end.setHours(0, 0, 0, 0);
        while (cursor <= end) {
          dayKeys.push(toDateKey(cursor.getTime()));
          cursor.setDate(cursor.getDate() + 1);
        }

        const logMap = new Map<
          string,
          Map<string, AttendanceLogWithEmployee[]>
        >();
        for (const log of filteredLogs) {
          if (log.type !== "IN" && log.type !== "OUT") continue;
          const dateKey = toDateKey(log.ts_local);
          const byEmp = logMap.get(log.employee_id) || new Map();
          const list = byEmp.get(dateKey) || [];
          list.push(log);
          byEmp.set(dateKey, list);
          logMap.set(log.employee_id, byEmp);
        }

        csvContent +=
          "Employee Code,Employee Name,Date,Shift Name,First In,Last Out,Work Hours,Late (min),Early Leave (min),OT (min),Status\n";

        const summaryMap = new Map<
          string,
          {
            present: number;
            absent: number;
            workMin: number;
            otMin: number;
            lateMin: number;
          }
        >();

        for (const employee of targetEmployees) {
          let presentDays = 0;
          let absentDays = 0;
          let totalWorkMin = 0;
          let totalOtMin = 0;
          let totalLateMin = 0;

          for (const dayKey of dayKeys) {
            const empLogs = logMap.get(employee.id)?.get(dayKey) || [];
            const inLogs = empLogs.filter((l) => l.type === "IN");
            const outLogs = empLogs.filter((l) => l.type === "OUT");

            const firstIn = inLogs.length
              ? Math.min(...inLogs.map((l) => l.ts_local))
              : null;
            const lastOut = outLogs.length
              ? Math.max(...outLogs.map((l) => l.ts_local))
              : null;

            const workMin =
              firstIn && lastOut && lastOut > firstIn
                ? Math.floor((lastOut - firstIn) / 60000)
                : 0;

            const status = firstIn ? "PRESENT" : "ABSENT";
            if (status === "PRESENT") {
              presentDays += 1;
              totalWorkMin += workMin;
            } else {
              absentDays += 1;
            }

            const row = [
              escapeCsv(employee.code || ""),
              escapeCsv(employee.name),
              dayKey,
              "Unassigned",
              firstIn ? formatTime(firstIn) : "",
              lastOut ? formatTime(lastOut) : "",
              workMin
                ? `${Math.floor(workMin / 60)
                    .toString()
                    .padStart(2, "0")}:${String(workMin % 60).padStart(2, "0")}`
                : "",
              totalLateMin.toString(),
              "0",
              totalOtMin.toString(),
              status,
            ].join(",");
            csvContent += row + "\n";
          }

          summaryMap.set(employee.id, {
            present: presentDays,
            absent: absentDays,
            workMin: totalWorkMin,
            otMin: totalOtMin,
            lateMin: totalLateMin,
          });
        }

        csvContent += "\nMonthly Summary\n";
        csvContent +=
          "Employee Code,Employee Name,Present,Absent,Total Work Min,Total OT Min,Total Late Min\n";
        for (const employee of targetEmployees) {
          const summary = summaryMap.get(employee.id) || {
            present: 0,
            absent: 0,
            workMin: 0,
            otMin: 0,
            lateMin: 0,
          };
          csvContent += `${escapeCsv(employee.code || "")},${escapeCsv(
            employee.name,
          )},${summary.present},${summary.absent},${summary.workMin},${summary.otMin},${summary.lateMin}\n`;
        }
      } else {
        const header =
          "Employee Name,Employee ID,Type,Date,Time,Confidence,Status\n";
        const rows = filteredLogs
          .map(
            (log) =>
              `${escapeCsv(log.employee_name)},${log.employee_id},${log.type},${formatDate(
                log.ts_local,
              )},${formatTime(
                log.ts_local,
              )},${log.confidence.toFixed(2)},${log.synced ? "Synced" : "Pending"}`,
          )
          .join("\n");
        csvContent = header + rows;
      }

      // Save to file (guarded for TS typings)
      const fs = FileSystem as any;
      const baseDir = fs.documentDirectory ?? fs.cacheDirectory ?? "";
      if (!baseDir) {
        throw new Error("No writable directory available");
      }
      const fileUri = `${baseDir}attendance_report_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert("Success", `Report saved to ${fileUri}`);
      }
    } catch (err: any) {
      console.warn("Failed to export CSV", err);
      Alert.alert("Error", "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const showDate = filter !== "today";

  const employeeOptions = useMemo(() => employees, [employees]);

  const filteredEmployeeOptions = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employeeOptions;
    return employeeOptions.filter((emp) =>
      emp.name.toLowerCase().includes(query),
    );
  }, [employeeOptions, employeeSearch]);

  const selectedEmployeeLabel = useMemo(() => {
    if (employeeFilter === "all") return "All employees";
    const match = employeeOptions.find((e) => e.id === employeeFilter);
    return match?.name || "Unknown";
  }, [employeeFilter, employeeOptions]);

  const filteredLogs = useMemo(() => {
    if (employeeFilter === "all") return logs;
    return logs.filter((log) => log.employee_id === employeeFilter);
  }, [logs, employeeFilter]);

  const tableColumns = useMemo(() => {
    const cols: any[] = [
      { key: "employee_name", title: "Name", flex: 2.2 },
      { key: "type", title: "IN/OUT", flex: 0.9, align: "center" },
    ];
    if (showDate) cols.push({ key: "date", title: "Date", width: 120 });
    cols.push({ key: "time", title: "Time", width: 110, align: "center" });
    cols.push({ key: "status", title: "Status", width: 110, align: "right" });
    return cols;
  }, [showDate]);

  const renderRow = (item: AttendanceLogWithEmployee) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
        {item.employee_name}
      </Text>
      <Text style={[styles.cell, styles.cellType]}>{item.type}</Text>
      {showDate && (
        <Text style={[styles.cell, styles.cellDate]}>
          {formatDate(item.ts_local)}
        </Text>
      )}
      <Text style={[styles.cell, styles.cellTime]}>
        {formatTime(item.ts_local)}
      </Text>
      <Text
        style={[
          styles.cell,
          styles.cellStatus,
          { color: item.synced ? PRIMARY_COLOR : "#F59E0B" },
        ]}
      >
        {item.synced ? "Synced" : "Pending"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Reports</Text>
        <Text style={styles.subtitle}>Total Logs: {logs.length}</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.employeeFilterContainer}>
        <Text style={styles.employeeFilterLabel}>Filter by employee</Text>
        <TouchableOpacity
          style={styles.employeePicker}
          onPress={() => setShowEmployeePicker(true)}
        >
          <Text style={styles.employeePickerText} numberOfLines={1}>
            {selectedEmployeeLabel}
          </Text>
          <Text style={styles.employeePickerChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attendance logs found</Text>
        </View>
      ) : (
        <View style={styles.tableWrapper}>
          <ScrollableTable
            columns={tableColumns}
            data={filteredLogs}
            keyExtractor={(item) => item.id}
            renderRow={renderRow}
            height={380}
            horizontal={false}
            style={{ marginHorizontal: 16 }}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Button
          title="Export CSV"
          onPress={handleExportCSV}
          loading={exporting}
          disabled={logs.length === 0 || exporting}
          style={styles.exportButton}
        />
      </View>

      <Modal
        visible={showEmployeePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmployeePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select employee</Text>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={employeeSearch}
                onChangeText={setEmployeeSearch}
                placeholder="Search by name"
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>
            <View style={styles.modalListContainer}>
              <FlatList
                data={[
                  { id: "all", name: "All employees" },
                  ...filteredEmployeeOptions,
                ]}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalRow,
                      employeeFilter === item.id && styles.modalRowActive,
                    ]}
                    onPress={() => {
                      setEmployeeFilter(item.id);
                      setEmployeeSearch("");
                      setShowEmployeePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalRowText,
                        employeeFilter === item.id && styles.modalRowTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
            <Button
              title="Close"
              variant="secondary"
              onPress={() => setShowEmployeePicker(false)}
              style={styles.modalCloseButton}
            />
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
    fontFamily: "sans-serif-medium",
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif",
  },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: SURFACE_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif-medium",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: 16,
  },
  tableContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: SURFACE_COLOR,
    overflow: "hidden",
  },
  tableWrapper: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F1F5F9",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif-medium",
  },
  cell: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontFamily: "sans-serif",
  },
  cellName: {
    flex: 2.2,
  },
  cellType: {
    flex: 0.9,
    textAlign: "center",
  },
  cellDate: {
    flex: 1.4,
    textAlign: "center",
  },
  cellTime: {
    flex: 1.2,
    textAlign: "center",
  },
  cellStatus: {
    flex: 1.2,
    textAlign: "right",
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
    textAlign: "center",
    fontFamily: "sans-serif-medium",
  },
  employeeFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  employeeFilterLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif-medium",
    marginBottom: 8,
  },
  employeePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: SURFACE_COLOR,
  },
  employeePickerText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: "sans-serif-medium",
  },
  employeePickerChevron: {
    color: TEXT_SECONDARY,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: SURFACE_COLOR,
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginBottom: 12,
    fontFamily: "sans-serif-medium",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BACKGROUND_COLOR,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontFamily: "sans-serif",
  },
  modalListContainer: {
    marginTop: 16,
    maxHeight: 300,
  },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  modalRowActive: {
    backgroundColor: SECONDARY_COLOR,
  },
  modalRowText: {
    color: TEXT_PRIMARY,
    fontFamily: "sans-serif-medium",
  },
  modalRowTextActive: {
    color: PRIMARY_COLOR,
  },
  modalCloseButton: {
    marginTop: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  exportButton: {
    width: "100%",
  },
});
