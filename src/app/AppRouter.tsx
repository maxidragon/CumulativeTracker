import { Box, CircularProgress } from "@mui/material";
import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { AppShell } from "./AppShell";
import { HomeScreen } from "../features/home/HomeScreen";

const CalculatorScreen = lazy(async () => ({
  default: (await import("../features/calculator/CalculatorScreen")).CalculatorScreen,
}));
const CompetitionOverviewScreen = lazy(async () => ({
  default: (await import("../features/competition/CompetitionOverviewScreen"))
    .CompetitionOverviewScreen,
}));
const CompetitionBoardScreen = lazy(async () => ({
  default: (await import("../features/competition/CompetitionBoardScreen"))
    .CompetitionBoardScreen,
}));
const CompetitorScreen = lazy(async () => ({
  default: (await import("../features/competition/CompetitorScreen"))
    .CompetitorScreen,
}));

function RouteLoading({ label }: { label: string }) {
  return (
    <Box aria-label={label} sx={{ display: "grid", placeItems: "center", py: 10 }}>
      <CircularProgress />
    </Box>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomeScreen />} />
          <Route
            path="calculator"
            element={
              <Suspense
                fallback={<RouteLoading label="Loading calculator" />}
              >
                <CalculatorScreen />
              </Suspense>
            }
          />
          <Route
            path="c/:competitionId"
            element={
              <Suspense fallback={<RouteLoading label="Loading competition" />}>
                <CompetitionOverviewScreen />
              </Suspense>
            }
          />
          <Route
            path="c/:competitionId/g/:groupKey"
            element={
              <Suspense fallback={<RouteLoading label="Loading group" />}>
                <CompetitionBoardScreen />
              </Suspense>
            }
          />
          <Route
            path="c/:competitionId/g/:groupKey/:registrantId"
            element={
              <Suspense fallback={<RouteLoading label="Loading competitor" />}>
                <CompetitorScreen />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <PlaceholderScreen
                eyebrow="Settings"
                title="Preferences and stored data"
                description="Theme overrides, tokens, and data controls will live here."
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
