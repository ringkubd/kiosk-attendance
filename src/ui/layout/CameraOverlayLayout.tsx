import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../spacing";

interface CameraOverlayLayoutProps {
  topSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
}

export const CameraOverlayLayout = ({
  topSlot,
  centerSlot,
  bottomSlot,
}: CameraOverlayLayoutProps) => {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || StatusBar.currentHeight || 0;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[
          styles.top,
          { paddingTop: topInset + spacing.sm, paddingHorizontal: spacing.md },
        ]}
        pointerEvents="box-none"
      >
        {topSlot}
      </View>
      <View style={styles.center} pointerEvents="box-none">
        {centerSlot}
      </View>
      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.md,
          },
        ]}
        pointerEvents="box-none"
      >
        {bottomSlot}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    alignItems: "center",
  },
});
