import React from "react";
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { colors } from "../../ui/tokens";
import { TextVariant, textVariantStyleMap } from "../../ui/typography";

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

export const Text = ({
  variant = "Admin/Body",
  color = colors.text.primary,
  style,
  children,
  ...rest
}: TextProps) => {
  const baseStyle = textVariantStyleMap[variant];
  return (
    <RNText
      style={[baseStyle, { color }, style as TextStyle]}
      {...rest}
    >
      {children}
    </RNText>
  );
};
