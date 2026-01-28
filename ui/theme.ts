import { Platform } from "react-native";
import {
  ACCENT_COLOR,
  BACKGROUND_COLOR,
  BORDER_COLOR,
  ERROR_COLOR,
  INFO_COLOR,
  PRIMARY_GRADIENT_END,
  PRIMARY_GRADIENT_START,
  PRIMARY_COLOR,
  SUCCESS_COLOR,
  SURFACE_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING_COLOR,
} from "../utils/constants";

export const colors = {
  primary: PRIMARY_COLOR,
  primaryGradientStart: PRIMARY_GRADIENT_START,
  primaryGradientEnd: PRIMARY_GRADIENT_END,
  accent: ACCENT_COLOR,
  background: BACKGROUND_COLOR,
  surface: SURFACE_COLOR,
  border: BORDER_COLOR,
  textPrimary: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  status: {
    success: SUCCESS_COLOR,
    warning: WARNING_COLOR,
    error: ERROR_COLOR,
    info: INFO_COLOR,
  },
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  round: 999,
};

export const shadows = {
  soft: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  subtle: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  fontFamilyMedium: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  fontFamilyBold: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  h1: 34,
  h2: 26,
  h3: 20,
  body: 16,
  bodyLarge: 18,
  caption: 13,
};

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
};
