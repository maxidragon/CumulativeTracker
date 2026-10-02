import { Box, CircularProgress } from "@mui/material";
import { lazy, Suspense, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RouteErrorBoundary } from "../components/RouteErrorBoundary";
import { AppShell } from "./AppShell";
import { HomeScreen } from "../features/home/HomeScreen";

const CalculatorScreen = lazy(async () => ({
  default: (await import("../features/calculator/CalculatorScreen")).CalculatorScreen,
}));
const CompetitionOverviewScreen = lazy(async () => ({
  default: (await import("../features/competition/CompetitionOverviewScreen"))
    .CompetitionOverviewScreen,
}));
const GroupScreen = lazy(async () => ({
  default: (await import("../features/competition/GroupScreen")).GroupScreen,
}));
const SettingsScreen = lazy(async () => ({
  default: (await import("../features/settings/SettingsScreen")).SettingsScreen,
}));

function RouteLoading({ label }: { label: string }) {
  return (
    <Box aria-label={label} sx={{ display: "grid", placeItems: "center", py: 10 }}>
      <CircularProgress />
    </Box>
  );
}

function RouteContent({
  children,
  loadingLabel,
}: {
  children: ReactNode;
  loadingLabel?: string;
}) {
  return (
    <RouteErrorBoundary>
      {loadingLabel ? (
        <Suspense fallback={<RouteLoading label={loadingLabel} />}>{children}</Suspense>
      ) : (
        children
      )}
    </RouteErrorBoundary>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            index
            element={
              <RouteContent>
                <HomeScreen />
              </RouteContent>
            }
          />
          <Route
            path="calculator"
            element={
              <RouteContent loadingLabel="Loading calculator">
                <CalculatorScreen />
              </RouteContent>
            }
          />
          <Route
            path="c/:competitionId"
            element={
              <RouteContent loadingLabel="Loading competition">
                <CompetitionOverviewScreen />
              </RouteContent>
            }
          />
          <Route
            path="c/:competitionId/g/:groupKey/:registrantId?"
            element={
              <RouteContent loadingLabel="Loading group">
                <GroupScreen />
              </RouteContent>
            }
          />
          <Route
            path="settings"
            element={
              <RouteContent loadingLabel="Loading settings">
                <SettingsScreen />
              </RouteContent>
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
