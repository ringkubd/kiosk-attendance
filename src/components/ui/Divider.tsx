import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../../ui";

interface DividerProps {
  style?: ViewStyle;
}

export const Divider = ({ style }: DividerProps) => {
  return <View style={[styles.divider, style]} />;
};

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
