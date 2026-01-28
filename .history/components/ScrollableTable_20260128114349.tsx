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
import { BORDER_COLOR, SURFACE_COLOR } from "../utils/constants";
import { colors, radii, spacing, typography } from "../ui/theme";

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
    renderRow?: (item: T) => React.ReactElement | null;
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

    // Render wrapper for FlatList to satisfy types
    const renderItemWrapper = ({ item }: { item: T }) => {
        const el = renderRow ? renderRow(item) : <DefaultRow item={item} />;
        return el;
    };

    const content = (
        <View style={styles.tableInner}>
            <Header />
            <FlatList
                data={data}
                keyExtractor={keyExtractor}
                renderItem={renderItemWrapper}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 8 }}
            />
        </View>
    );

    return (
        <View style={[{ height }, styles.container, style]}>
            {horizontal ? (
                <ScrollView horizontal showsHorizontalScrollIndicator scrollEnabled={true} nestedScrollEnabled={true}>
                    <View style={{ minWidth: Math.max(600, columns.reduce((s, c) => s + (c.width || 120), 0)) }}>
                        {content}
                    </View>
                </ScrollView>
            ) : (
                <View style={styles.tableWrapper}>{content}</View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.md,
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
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: "#F8FAFB",
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
    },
    headerRowHorizontal: {
        minWidth: 600,
    },
    headerCell: {
        paddingRight: spacing.md,
    },
    headerText: {
        fontSize: typography.caption,
        fontWeight: "700",
        color: colors.textSecondary,
        fontFamily: typography.fontFamilyMedium,
    },
    list: {
        flex: 1,
    },
    tableWrapper: {
        flex: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
    },
    rowHorizontal: {
        minWidth: 600,
    },
    cell: {},
    cellText: {
        fontSize: typography.caption,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily,
    },
    centerText: {
        textAlign: "center",
    },
    rightText: {
        textAlign: "right",
    },
});

export default ScrollableTable;
