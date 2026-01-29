import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../tokens";
import { spacing } from "../spacing";
import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export const AppHeader = ({
  title,
  subtitle,
  rightSlot,
  showBack = false,
  onBack,
}: AppHeaderProps) => {
  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={22} color={colors.text.primary} />
        </Pressable>
      ) : null}
      <View style={styles.textBlock}>
        <Text variant="Admin/H1" color={colors.text.primary}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="Admin/Body" color={colors.text.secondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  rightSlot: {
    alignItems: "flex-end",
  },
});
