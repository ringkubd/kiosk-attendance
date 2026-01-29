import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing } from "../../ui";
import { Text } from "./Text";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  iconName?: React.ComponentProps<typeof Icon>["name"];
  style?: ViewStyle;
}

export const Button = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  iconName,
  style,
}: ButtonProps) => {
  const isDisabled = disabled || loading;
  const palette = variantStyles[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        palette.container,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.text} />
        ) : (
          <>
            {iconName ? (
              <Icon name={iconName} size={18} color={palette.text} style={styles.icon} />
            ) : null}
            <Text variant="Admin/Body" color={palette.text}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: spacing.xxl,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing.xs,
  },
});

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; text: string }
> = {
  primary: {
    container: {
      backgroundColor: colors.brand.primary,
      borderWidth: 1,
      borderColor: colors.brand.primary,
    },
    text: colors.text.inverse,
  },
  secondary: {
    container: {
      backgroundColor: colors.bg.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: colors.text.primary,
  },
  danger: {
    container: {
      backgroundColor: colors.status.absent,
      borderWidth: 1,
      borderColor: colors.status.absent,
    },
    text: colors.text.inverse,
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "transparent",
    },
    text: colors.brand.primary,
  },
};
