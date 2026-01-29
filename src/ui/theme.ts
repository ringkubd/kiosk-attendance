import { colors, statusColorMap } from "./tokens";
import { spacing } from "./spacing";
import { radii } from "./radii";
import { shadows } from "./shadows";
import { textVariantStyleMap, typography } from "./typography";

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  textVariants: textVariantStyleMap,
  statusColorMap,
} as const;

export type Theme = typeof theme;
