// Typography tokens mapped to Figma styles
export const fontFamilies = {
  kiosk: {
    regular: "Inter",
    medium: "Inter",
    bold: "Inter",
  },
  admin: {
    regular: "Roboto",
    medium: "Roboto",
    bold: "Roboto",
  },
} as const;

export const typography = {
  kiosk: {
    h1: { fontSize: 32, fontWeight: "700" as const },
    h2: { fontSize: 24, fontWeight: "600" as const },
    body: { fontSize: 18, fontWeight: "500" as const },
  },
  admin: {
    h1: { fontSize: 22, fontWeight: "600" as const },
    h2: { fontSize: 18, fontWeight: "600" as const },
    body: { fontSize: 14, fontWeight: "400" as const },
    caption: { fontSize: 12, fontWeight: "400" as const },
  },
} as const;

export type TextVariant =
  | "Kiosk/H1"
  | "Kiosk/H2"
  | "Kiosk/Body"
  | "Admin/H1"
  | "Admin/H2"
  | "Admin/Body"
  | "Admin/Caption";

export const textVariantStyleMap: Record<TextVariant, {
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
}> = {
  "Kiosk/H1": {
    fontSize: typography.kiosk.h1.fontSize,
    fontWeight: typography.kiosk.h1.fontWeight,
    fontFamily: fontFamilies.kiosk.bold,
  },
  "Kiosk/H2": {
    fontSize: typography.kiosk.h2.fontSize,
    fontWeight: typography.kiosk.h2.fontWeight,
    fontFamily: fontFamilies.kiosk.medium,
  },
  "Kiosk/Body": {
    fontSize: typography.kiosk.body.fontSize,
    fontWeight: typography.kiosk.body.fontWeight,
    fontFamily: fontFamilies.kiosk.medium,
  },
  "Admin/H1": {
    fontSize: typography.admin.h1.fontSize,
    fontWeight: typography.admin.h1.fontWeight,
    fontFamily: fontFamilies.admin.medium,
  },
  "Admin/H2": {
    fontSize: typography.admin.h2.fontSize,
    fontWeight: typography.admin.h2.fontWeight,
    fontFamily: fontFamilies.admin.medium,
  },
  "Admin/Body": {
    fontSize: typography.admin.body.fontSize,
    fontWeight: typography.admin.body.fontWeight,
    fontFamily: fontFamilies.admin.regular,
  },
  "Admin/Caption": {
    fontSize: typography.admin.caption.fontSize,
    fontWeight: typography.admin.caption.fontWeight,
    fontFamily: fontFamilies.admin.regular,
  },
};
