import { useWindowDimensions } from "react-native";

export type Breakpoint = "small" | "phone" | "tablet";

export const useBreakpoint = (): {
  breakpoint: Breakpoint;
  width: number;
  isSmall: boolean;
  isPhone: boolean;
  isTablet: boolean;
} => {
  const { width } = useWindowDimensions();
  const breakpoint: Breakpoint =
    width < 360 ? "small" : width < 600 ? "phone" : "tablet";

  return {
    breakpoint,
    width,
    isSmall: breakpoint === "small",
    isPhone: breakpoint === "phone",
    isTablet: breakpoint === "tablet",
  };
};
