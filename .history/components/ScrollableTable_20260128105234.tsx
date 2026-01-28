import React from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {
  BORDER_COLOR,
  PRIMARY_COLOR,
  SURFACE_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../utils/constants";

type Column = {
  key: string;
  title: string;
  width?: number; // fixed width for horizontal scroll
  flex?: number; // flexible width
  align?: "left" | "center" | "right";
};

interface Props<T = any> {
  columns: Column[];
  data: T[];
  keyExtractor: (item: T) => string;
  renderRow?: (item: T) => React.ReactNode;
  onRowPress?: (item: T) => void;
  height?: number;
  horizontal?: boolean; // enable horizontal scroll for wide tables
  style?: ViewStyle;
}

export function ScrollableTable<T = any>({
  columns,
  data,
  keyExtractor,
  renderRow,
  onRowPress,
  height = 320,
  horizontal = false,
  style,
}: Props<T>) {
  const Header = () => (
    <View style={[styles.headerRow, horizontal && styles.headerRowHorizontal]}>
      {columns.map((col) => (
        <View
          key={col.key}
          style={[
            styles.headerCell,
            col.width ? { width: col.width } : col.flex ? { flex: col.flex } : { flex: 1 },
          ]}
        >
          <Text style={styles.headerText}>{col.title}</Text>
        </View>
      ))}
    </View>
  );

  const DefaultRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={onRowPress ? 0.7 : 1}
      onPress={() => onRowPress?.(item)}
      style={[styles.row, horizontal && styles.rowHorizontal]}
    >
      {columns.map((col) => (
        <View
          key={col.key}
          style={[
            styles.cell,
            col.width ? { width: col.width } : col.flex ? { flex: col.flex } : { flex: 1 },
          ]}
        >
          <Text
            style={[
              styles.cellText,
              col.align === "center" && styles.centerText,
              col.align === "right" && styles.rightText,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {String(item[col.key] ?? "")}
          </Text>
        </View>
      ))}
    </TouchableOpacity>
  );

  const content = (
    <View style={styles.tableInner}>
      <Header />
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderRow ? ({ item }) => renderRow(item) : DefaultRow}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 8 }}
      />
    </View>
  );

  return (
    <View style={[{ height }, styles.container, style]}>
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ minWidth: Math.max(600, columns.reduce((s, c) => s + (c.width || 120), 0)) }}>
            {content}
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: SURFACE_COLOR,
    overflow: "hidden",
  },
  tableInner: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFB",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  headerRowHorizontal: {
    minWidth: 600,
  },
  headerCell: {
    paddingRight: 12,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    fontFamily: "sans-serif-medium",
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  rowHorizontal: {
    minWidth: 600,
  },
  cell: {},
  cellText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontFamily: "sans-serif",
  },
  centerText: {
    textAlign: "center",
  },
  rightText: {
    textAlign: "right",
  },
});

export default ScrollableTable;
