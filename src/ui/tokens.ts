// Design tokens mapped to Figma styles
export const colors = {
  brand: {
    primary: "#1E88E5",
    primaryLight: "#42A5F5",
    accent: "#F57C00",
  },
  bg: {
    default: "#F5F7FA",
    surface: "#FFFFFF",
    elevated: "#FAFAFA",
  },
  status: {
    present: "#2E7D32",
    absent: "#C62828",
    lateIn: "#F9A825",
    lateOut: "#EF6C00",
    noLogout: "#6A1B9A",
    info: "#1565C0",
  },
  text: {
    primary: "#0F172A",
    secondary: "#64748B",
    inverse: "#FFFFFF",
  },
  border: "#E2E8F0",
  shadow: "rgba(0,0,0,0.08)",
} as const;

export type StatusCode = "P" | "A" | "LI" | "LO" | "NL" | "INFO";

export const statusColorMap: Record<StatusCode, string> = {
  P: colors.status.present,
  A: colors.status.absent,
  LI: colors.status.lateIn,
  LO: colors.status.lateOut,
  NL: colors.status.noLogout,
  INFO: colors.status.info,
};
