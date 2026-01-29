import React from "react";
import { ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface IconProps {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const Icon = ({ name, size = 20, color, style }: IconProps) => {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
};
