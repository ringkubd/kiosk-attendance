import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../ui";

const GUIDE_SIZE = 260;
const GUIDE_RADIUS = GUIDE_SIZE / 2;

export const FaceGuideOverlay = () => {
  return <View style={styles.oval} />;
};

const styles = StyleSheet.create({
  oval: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    borderRadius: GUIDE_RADIUS,
    backgroundColor: "rgba(30, 136, 229, 0.08)",
  },
});
