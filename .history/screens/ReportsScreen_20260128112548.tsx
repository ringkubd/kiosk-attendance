// Reports Screen
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, SectionHeader, StatusBadge } from "../components/common";
import { ScrollableTable } from "../components/ScrollableTable";
import {
  getAllEmployees,
  getAttendanceLogsWithEmployeeByDateRange,
} from "../db/database";
import { getActiveOrgBranchIds } from "../services/settings";
import type { AttendanceLogWithEmployee } from "../types";
import { colors, radii, spacing, typography } from "../ui/theme";
import {
  BACKGROUND_COLOR,
  BORDER_COLOR,
  SECONDARY_COLOR,
  SURFACE_COLOR,
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
  const [printing, setPrinting] = useState(false);
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

      // Save to file with robust fallbacks
      const fs = FileSystem as any;
      let fileUri: string | null = null;

      // Log available directories for debugging
      console.log("FileSystem.documentDirectory:", fs.documentDirectory);
      console.log("FileSystem.cacheDirectory:", fs.cacheDirectory);

      // Try preferred directories: documentDirectory, then cacheDirectory
      const candidates = [fs.documentDirectory, fs.cacheDirectory].filter(Boolean);

      if (candidates.length === 0) {
        // No standard directories available - show helpful error
        console.error("No writable directories found");
        Alert.alert(
          "Export Failed",
          "Unable to access device storage. Please check app permissions in Settings and try again.",
          [
            {
              text: "Copy to Clipboard",
              onPress: async () => {
                // Fallback: copy CSV content to clipboard
                try {
                  await Clipboard.setStringAsync(csvContent);
                  Alert.alert("Success", "Report copied to clipboard. Paste into a spreadsheet app.");
                } catch (clipErr) {
                  console.error("Clipboard failed:", clipErr);
                  Alert.alert("Failed", "Unable to copy to clipboard");
                }
              },
            },
            { text: "OK" },
          ],
        );
        return;
      }

      let baseDir = candidates[0];

      try {
        // Try to create a subfolder for clarity
        const reportsDir = `${baseDir}Reports/`;
        try {
          const info = await FileSystem.getInfoAsync(reportsDir);
          if (!info.exists) {
            await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
          }
          fileUri = `${reportsDir}attendance_report_${Date.now()}.csv`;
        } catch (dirErr: any) {
          console.warn("Failed to create Reports directory:", dirErr);
          // If creating subdir fails, fall back to baseDir
          fileUri = `${baseDir}attendance_report_${Date.now()}.csv`;
        }

        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        console.log("CSV written successfully to:", fileUri);
      } catch (writeErr: any) {
        console.error("Write failed for primary location:", writeErr);
        // Last-ditch fallback: try alternate directory if available
        for (let i = 1; i < candidates.length; i++) {
          try {
            fileUri = `${candidates[i]}attendance_report_${Date.now()}.csv`;
            await FileSystem.writeAsStringAsync(fileUri, csvContent);
            console.log("CSV written to fallback location:", fileUri);
            break;
          } catch (fallbackErr: any) {
            console.error(`Fallback ${i} failed:`, fallbackErr);
            if (i === candidates.length - 1) {
              // All attempts failed
              throw new Error(
                `File write failed: ${writeErr.message || "Unknown error"}`,
              );
            }
          }
        }
      }

      // Share file
      if (fileUri) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: "text/csv",
              dialogTitle: "Export Attendance Report",
            });
          } else {
            Alert.alert("Success", `Report saved to:\n${fileUri}`);
          }
        } catch (shareErr: any) {
          console.warn("Sharing failed:", shareErr);
          Alert.alert("Saved", `Report saved but sharing failed.\nFile location:\n${fileUri}`);
        }
      } else {
        throw new Error("Failed to write report file");
      }
    } catch (err: any) {
      console.warn("Failed to export CSV", err);
      Alert.alert("Error", "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (logs.length === 0) {
      Alert.alert("No Data", "No logs to print");
      return;
    }

    setPrinting(true);
    try {
      const { startTime, endTime } = getRange();
      const { orgId, branchId } = await getActiveOrgBranchIds();
      const employees = await getAllEmployees(orgId, branchId);
      const targetEmployees =
        employeeFilter === "all"
          ? employees
          : employees.filter((e) => e.id === employeeFilter);

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #2563EB;
              font-size: 24px;
              margin-bottom: 8px;
            }
            .subtitle {
              color: #666;
              font-size: 14px;
              margin-bottom: 20px;
            }
            .filter-info {
              background: #f8f9fa;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 20px;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
            }
            th {
              background: #2563EB;
              color: white;
              padding: 12px 8px;
              text-align: left;
              font-size: 12px;
              font-weight: 600;
            }
            td {
              padding: 10px 8px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 12px;
            }
            tr:nth-child(even) {
              background: #f8fafc;
            }
            .status-synced {
              color: #2563EB;
              font-weight: 600;
            }
            .status-pending {
              color: #F59E0B;
              font-weight: 600;
            }
            .summary {
              margin-top: 30px;
              padding: 16px;
              background: #f1f5f9;
              border-radius: 8px;
            }
            .summary h2 {
              font-size: 18px;
              margin-bottom: 12px;
              color: #2563EB;
            }
            @media print {
              body { padding: 10px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <h1>Attendance Report</h1>
          <div class="subtitle">Total Logs: ${filteredLogs.length}</div>
          <div class="filter-info">
            <strong>Period:</strong> ${filter.charAt(0).toUpperCase() + filter.slice(1)}<br>
            <strong>Employee Filter:</strong> ${selectedEmployeeLabel}<br>
            <strong>Generated:</strong> ${new Date().toLocaleString()}
          </div>
      `;

      if (filter === "month") {
        // Monthly report with summary
        const toDateKey = (ts: number) => {
          const d = new Date(ts);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        const dayKeys: string[] = [];
        const cursor = new Date(startTime);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(endTime);
        end.setHours(0, 0, 0, 0);
        while (cursor <= end) {
          dayKeys.push(toDateKey(cursor.getTime()));
          cursor.setDate(cursor.getDate() + 1);
        }

        const logMap = new Map<string, Map<string, AttendanceLogWithEmployee[]>>();
        for (const log of filteredLogs) {
          if (log.type !== "IN" && log.type !== "OUT") continue;
          const dateKey = toDateKey(log.ts_local);
          const byEmp = logMap.get(log.employee_id) || new Map();
          const list = byEmp.get(dateKey) || [];
          list.push(log);
          byEmp.set(dateKey, list);
          logMap.set(log.employee_id, byEmp);
        }

        htmlContent += `
          <table>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Date</th>
                <th>First In</th>
                <th>Last Out</th>
                <th>Work Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
        `;

        const summaryMap = new Map<string, { present: number; absent: number; workMin: number }>();

        for (const employee of targetEmployees) {
          let presentDays = 0;
          let absentDays = 0;
          let totalWorkMin = 0;

          for (const dayKey of dayKeys) {
            const empLogs = logMap.get(employee.id)?.get(dayKey) || [];
            const inLogs = empLogs.filter((l) => l.type === "IN");
            const outLogs = empLogs.filter((l) => l.type === "OUT");

            const firstIn = inLogs.length ? Math.min(...inLogs.map((l) => l.ts_local)) : null;
            const lastOut = outLogs.length ? Math.max(...outLogs.map((l) => l.ts_local)) : null;

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

            htmlContent += `
              <tr>
                <td>${employee.code || ""}</td>
                <td>${employee.name}</td>
                <td>${dayKey}</td>
                <td>${firstIn ? formatTime(firstIn) : ""}</td>
                <td>${lastOut ? formatTime(lastOut) : ""}</td>
                <td>${workMin ? `${Math.floor(workMin / 60).toString().padStart(2, "0")}:${String(workMin % 60).padStart(2, "0")}` : ""}</td>
                <td>${status}</td>
              </tr>
            `;
          }

          summaryMap.set(employee.id, { present: presentDays, absent: absentDays, workMin: totalWorkMin });
        }

        htmlContent += `
            </tbody>
          </table>
          <div class="summary">
            <h2>Monthly Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Employee Name</th>
                  <th>Present Days</th>
                  <th>Absent Days</th>
                  <th>Total Work Minutes</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const employee of targetEmployees) {
          const summary = summaryMap.get(employee.id) || { present: 0, absent: 0, workMin: 0 };
          htmlContent += `
            <tr>
              <td>${employee.code || ""}</td>
              <td>${employee.name}</td>
              <td>${summary.present}</td>
              <td>${summary.absent}</td>
              <td>${summary.workMin}</td>
            </tr>
          `;
        }

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      } else {
        // Regular daily/weekly/all report
        htmlContent += `
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Type</th>
                ${showDate ? "<th>Date</th>" : ""}
                <th>Time</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const log of filteredLogs) {
          htmlContent += `
            <tr>
              <td>${log.employee_name}</td>
              <td>${log.type}</td>
              ${showDate ? `<td>${formatDate(log.ts_local)}</td>` : ""}
              <td>${formatTime(log.ts_local)}</td>
              <td>${(log.confidence * 100).toFixed(1)}%</td>
              <td class="${log.synced ? "status-synced" : "status-pending"}">
                ${log.synced ? "Synced" : "Pending"}
              </td>
            </tr>
          `;
        }

        htmlContent += `
            </tbody>
          </table>
        `;
      }

      htmlContent += `
        </body>
        </html>
      `;

      // Print with option to save as PDF
      await Print.printAsync({
        html: htmlContent,
        width: 612, // Letter size width in points
        height: 792, // Letter size height in points
      });
    } catch (err: any) {
      console.warn("Failed to print", err);
      Alert.alert("Error", "Failed to print report");
    } finally {
      setPrinting(false);
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
      <View style={styles.cellStatusWrap}>
        <StatusBadge
          label={item.synced ? "Synced" : "Pending"}
          tone={item.synced ? "info" : "warning"}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionHeader
          title="Attendance Reports"
          subtitle={`Total Logs: ${logs.length}`}
        />
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
            horizontal={filter === "month"}
            style={{ marginHorizontal: 16 }}
          />
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerButtonsContainer}>
          <Button
            title="Print / PDF"
            onPress={handlePrint}
            loading={printing}
            disabled={logs.length === 0 || printing || exporting}
            variant="secondary"
            style={styles.footerButton}
          />
          <Button
            title="Export CSV"
            onPress={handleExportCSV}
            loading={exporting}
            disabled={logs.length === 0 || exporting || printing}
            style={styles.footerButton}
          />
        </View>
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
    padding: spacing.lg,
    backgroundColor: SURFACE_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  filterContainer: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: SURFACE_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    fontFamily: typography.fontFamilyMedium,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: spacing.md,
  },
  tableContainer: {
    marginHorizontal: spacing.md,
    marginTop: 4,
    borderRadius: radii.lg,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: "#F1F5F9",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  headerCell: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    fontFamily: typography.fontFamilyMedium,
  },
  cell: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
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
    fontFamily: typography.fontFamilyMedium,
  },
  cellStatusWrap: {
    flex: 1.2,
    alignItems: "flex-end",
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
    textAlign: "center",
    fontFamily: typography.fontFamilyMedium,
  },
  employeeFilterContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  employeeFilterLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontFamily: typography.fontFamilyMedium,
    marginBottom: spacing.sm,
  },
  employeePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: SURFACE_COLOR,
  },
  employeePickerText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
  employeePickerChevron: {
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: SURFACE_COLOR,
    borderRadius: radii.lg,
    padding: spacing.md,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  modalTitle: {
    fontSize: typography.h3,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamilyBold,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: BACKGROUND_COLOR,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
  },
  modalListContainer: {
    marginTop: spacing.md,
    maxHeight: 300,
  },
  modalRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  modalRowActive: {
    backgroundColor: SECONDARY_COLOR,
  },
  modalRowText: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyMedium,
  },
  modalRowTextActive: {
    color: colors.primary,
  },
  modalCloseButton: {
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: SURFACE_COLOR,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  footerButtonsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  exportButton: {
    width: "100%",
  },
});
