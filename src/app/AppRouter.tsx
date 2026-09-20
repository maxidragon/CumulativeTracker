import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { AppShell } from "./AppShell";
import { HomeScreen } from "../features/home/HomeScreen";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomeScreen />} />
          <Route
            path="calculator"
            element={
              <PlaceholderScreen
                eyebrow="Calculator"
                title="Track a budget without a competition"
                description="The cumulative engine and WCA-style attempt input arrive in the next milestone."
              />
            }
          />
          <Route
            path="c/:competitionId"
            element={
              <PlaceholderScreen
                eyebrow="Competition"
                title="Competition overview"
                description="Public WCIF loading and cumulative group selection will live here."
              />
            }
          />
          <Route
            path="c/:competitionId/g/:groupKey"
            element={
              <PlaceholderScreen
                eyebrow="Group board"
                title="Competitor budgets"
                description="This route will sort competitors by remaining time and sync state."
              />
            }
          />
          <Route
            path="c/:competitionId/g/:groupKey/:registrantId"
            element={
              <PlaceholderScreen
                eyebrow="Competitor"
                title="Attempt entry"
                description="This route will keep the next-attempt cap above the fold."
              />
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
