// Common UI components
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { ACCENT_COLOR, BORDER_COLOR, SURFACE_COLOR } from "../utils/constants";
import { colors, radii, shadows, spacing, typography } from "../ui/theme";

// Button Component
interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
}: ButtonProps) {
  const getButtonStyle = () => {
    if (disabled) return styles.buttonDisabled;
    switch (variant) {
      case "secondary":
        return styles.buttonSecondary;
      case "danger":
        return styles.buttonDanger;
      case "ghost":
        return styles.buttonGhost;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    if (disabled) return styles.buttonTextDisabled;
    if (variant === "secondary" || variant === "ghost") {
      return styles.buttonTextSecondary;
    }
    return styles.buttonText;
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.buttonText, getTextStyle()]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

// Card Component
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function StatusBadge({
  label,
  tone = "info",
  style,
}: {
  label: string;
  tone?: "success" | "warning" | "error" | "info";
  style?: ViewStyle;
}) {
  const toneStyle =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "warning"
        ? styles.badgeWarning
        : tone === "error"
          ? styles.badgeError
          : styles.badgeInfo;

  return (
    <View style={[styles.badge, toneStyle, style]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  tone = "info",
  style,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "error" | "info";
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.metricCard, style]}>
      <Text style={styles.metricValue}>{value}</Text>
      <StatusBadge
        label={label}
        tone={tone}
        style={styles.metricBadge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  buttonPrimary: {
    backgroundColor: ACCENT_COLOR,
    ...shadows.soft,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.status.error,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0.2,
    fontFamily: typography.fontFamilyBold,
  },
  buttonTextSecondary: {
    color: colors.textPrimary,
  },
  buttonTextDisabled: {
    color: "#94A3B8",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.h2,
    fontWeight: "700",
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyBold,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    fontFamily: typography.fontFamilyBold,
  },
  badgeSuccess: {
    backgroundColor: colors.status.success,
  },
  badgeWarning: {
    backgroundColor: colors.status.warning,
  },
  badgeError: {
    backgroundColor: colors.status.error,
  },
  badgeInfo: {
    backgroundColor: colors.status.info,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    fontFamily: typography.fontFamilyBold,
  },
  metricBadge: {
    marginTop: spacing.sm,
  },
});
