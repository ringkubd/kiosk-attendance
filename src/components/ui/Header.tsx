import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../ui";
import { Text } from "./Text";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header = ({ title, subtitle }: HeaderProps) => {
  return (
    <View style={styles.container}>
      <Text variant="Admin/H2">{title}</Text>
      {subtitle ? (
        <Text variant="Admin/Body" color={colors.text.secondary}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
