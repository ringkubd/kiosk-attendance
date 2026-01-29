import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../tokens";
import { spacing } from "../spacing";
import { useBreakpoint } from "./useBreakpoint";

export type ScreenPadding = "none" | "sm" | "md" | "lg";
export type ScreenVariant = "fixed" | "scroll";
export type ScreenBackground = "default" | "surface";

export interface ScreenProps {
  children: React.ReactNode;
  variant?: ScreenVariant;
  padding?: ScreenPadding;
  background?: ScreenBackground;
  keyboardSafe?: boolean;
  statusBarStyle?: "light-content" | "dark-content";
  applyInsets?: boolean;
}

const paddingMap: Record<ScreenPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export const Screen = ({
  children,
  variant = "fixed",
  padding = "md",
  background = "default",
  keyboardSafe = false,
  statusBarStyle = "dark-content",
  applyInsets = true,
}: ScreenProps) => {
  const { isTablet } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const safeInsets = applyInsets ? insets : { top: 0, bottom: 0, left: 0, right: 0 };
  const basePadding = paddingMap[padding];
  const padded = isTablet ? basePadding + spacing.sm : basePadding;
  const backgroundColor =
    background === "surface" ? colors.bg.surface : colors.bg.default;

  const contentStyle: ViewStyle = {
    flex: 1,
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const innerStyle: ViewStyle = {
    flex: 1,
  };

  const contentPadding = {
    paddingHorizontal: padded,
    paddingTop: padded + safeInsets.top,
    paddingBottom: padded + safeInsets.bottom,
  };

  const scrollPadding = {
    paddingHorizontal: padded,
    paddingTop: padded + safeInsets.top,
    paddingBottom: safeInsets.bottom + spacing.md,
  };

  const content =
    variant === "scroll" ? (
      <ScrollView
        style={contentStyle}
        contentContainerStyle={[styles.scrollContent, scrollPadding]}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[innerStyle, contentPadding]}>{children}</View>
    );

  const body = (
    <SafeAreaView style={containerStyle} edges={["left", "right"]}>
      <StatusBar barStyle={statusBarStyle} />
      <View style={styles.body}>{content}</View>
    </SafeAreaView>
  );

  if (!keyboardSafe) {
    return body;
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {body}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
});
