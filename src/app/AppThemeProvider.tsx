import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useSettingsStore } from "../features/settings/store";

export function AppThemeProvider({ children }: PropsWithChildren) {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preference = useSettingsStore((state) => state.settings.theme);
  const darkMode = preference === "dark" || (preference === "system" && prefersDarkMode);
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: darkMode ? "#8bb9ff" : "#175cd3" },
          secondary: { main: darkMode ? "#7ee2b8" : "#087e5b" },
          background: darkMode
            ? { default: "#101828", paper: "#1d2939" }
            : { default: "#f8fafc", paper: "#ffffff" },
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          h1: { fontWeight: 750, letterSpacing: "-0.04em" },
          h2: { fontWeight: 700, letterSpacing: "-0.025em" },
          button: { fontWeight: 700, textTransform: "none" },
        },
        components: {
          MuiButton: {
            styleOverrides: { root: { minHeight: 44 } },
          },
          MuiIconButton: {
            styleOverrides: { root: { minHeight: 44, minWidth: 44 } },
          },
        },
      }),
    [darkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
