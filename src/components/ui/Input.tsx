import React from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { colors, radii, spacing } from "../../ui";
import { textVariantStyleMap } from "../../ui/typography";
import { Text } from "./Text";

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
}

export const Input = ({ label, helperText, style, ...rest }: InputProps) => {
  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="Admin/Caption" color={colors.text.primary}>
          {label}
        </Text>
      ) : null}
      {helperText ? (
        <Text variant="Admin/Caption" color={colors.text.secondary}>
          {helperText}
        </Text>
      ) : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.text.secondary}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: textVariantStyleMap["Admin/Body"].fontSize,
    fontFamily: textVariantStyleMap["Admin/Body"].fontFamily,
    backgroundColor: colors.bg.surface,
  },
});
