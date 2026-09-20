import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";

export function AppThemeProvider({ children }: PropsWithChildren) {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
          primary: { main: prefersDarkMode ? "#8bb9ff" : "#175cd3" },
          secondary: { main: prefersDarkMode ? "#7ee2b8" : "#087e5b" },
          background: prefersDarkMode
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
    [prefersDarkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
