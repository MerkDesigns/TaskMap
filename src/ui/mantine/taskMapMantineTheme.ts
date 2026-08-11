import { createTheme } from "@mantine/core";

export const taskMapFontFamily =
  '"Segoe UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export const taskMapMantineTheme = createTheme({
  fontFamily: taskMapFontFamily,
  headings: {
    fontFamily: taskMapFontFamily,
    fontWeight: "600",
  },
  defaultRadius: "md",
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
  },
});
