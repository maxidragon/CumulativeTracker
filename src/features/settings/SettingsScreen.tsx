import { DeleteOutlined, Download, LockOutlined, Storage } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmActionDialog } from "../../components/ConfirmActionDialog";
import {
  clearAllStoredData,
  downloadSafeDataExport,
  listStoredData,
} from "../../lib/storage";
import {
  forgetScoretakingToken,
  maskScoretakingToken,
  readScoretakingToken,
} from "../../lib/wcaLive";
import { useAuthStore } from "../auth/store";
import { useCalculatorStore } from "../calculator/store";
import { useTrackingStore } from "../competition/trackingStore";
import { useSettingsStore, type ThemePreference } from "./store";

const themeLabels: Record<ThemePreference, string> = {
  system: "Use device setting",
  light: "Light",
  dark: "Dark",
};

export function SettingsScreen() {
  const theme = useSettingsStore((state) => state.settings.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const signOut = useAuthStore((state) => state.signOut);
  const resetCalculator = useCalculatorStore((state) => state.resetCalculator);
  const resetTracking = useTrackingStore((state) => state.resetTracking);
  const queryClient = useQueryClient();
  const [, setRevision] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);
  const items = listStoredData();
  const tokenItems = items.filter(({ kind }) => kind === "token");
  const competitionIds = [
    ...new Set(
      items.flatMap(({ kind, competitionId }) =>
        kind === "competition" && competitionId ? [competitionId] : [],
      ),
    ),
  ];
  const hasSession = items.some(({ kind }) => kind === "session");

  const clearDescription = [
    `${items.length} stored item${items.length === 1 ? "" : "s"}`,
    `${competitionIds.length} competition${competitionIds.length === 1 ? "" : "s"}`,
    `${tokenItems.length} WCA Live token${tokenItems.length === 1 ? "" : "s"}`,
    hasSession ? "your WCA sign-in" : null,
  ]
    .filter((value): value is string => value !== null)
    .join(", ");

  return (
    <Stack spacing={4} sx={{ maxWidth: 760 }}>
      <Box>
        <Typography color="primary" sx={{ fontWeight: 800 }} variant="overline">
          Settings
        </Typography>
        <Typography component="h1" variant="h2">
          Preferences and stored data
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Everything below stays in this browser. Exports never include sign-in or
          scoretaking tokens.
        </Typography>
      </Box>

      {cleared ? (
        <Alert severity="success">
          All Cumulative Tracker data was cleared. Reloading or leaving this page starts
          with fresh defaults.
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Typography component="h2" gutterBottom variant="h5">
            Appearance
          </Typography>
          <FormControl>
            <RadioGroup
              aria-label="Color theme"
              onChange={(event) => setTheme(event.target.value as ThemePreference)}
              value={theme}
            >
              {(Object.keys(themeLabels) as ThemePreference[]).map((preference) => (
                <FormControlLabel
                  control={<Radio />}
                  key={preference}
                  label={themeLabels[preference]}
                  value={preference}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography component="h2" variant="h5">
                WCA Live tokens
              </Typography>
              <Typography color="text.secondary">
                Tokens are scoped to one competition and shown only by their last four
                characters.
              </Typography>
            </Box>
            {tokenItems.length === 0 ? (
              <Typography color="text.secondary">No scoretaking tokens stored.</Typography>
            ) : (
              tokenItems.map(({ key, competitionId = "Unknown competition" }) => {
                const token = readScoretakingToken(competitionId);
                return (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    key={key}
                    spacing={1}
                    sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{competitionId}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        <LockOutlined aria-hidden="true" fontSize="inherit" /> {token
                          ? maskScoretakingToken(token.token)
                          : "Unreadable token"}
                      </Typography>
                    </Box>
                    <Button
                      color="error"
                      onClick={() => {
                        forgetScoretakingToken(competitionId);
                        setRevision((current) => current + 1);
                      }}
                    >
                      Forget token
                    </Button>
                  </Stack>
                );
              })
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography component="h2" variant="h5">
                Stored data
              </Typography>
              <Typography color="text.secondary">
                <Storage aria-hidden="true" fontSize="inherit" /> {items.length} item
                {items.length === 1 ? "" : "s"} in this browser
                {competitionIds.length > 0
                  ? ` · competitions: ${competitionIds.join(", ")}`
                  : ""}
              </Typography>
            </Box>
            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                onClick={downloadSafeDataExport}
                startIcon={<Download />}
                variant="outlined"
              >
                Export my data
              </Button>
              <Button
                color="error"
                disabled={items.length === 0}
                onClick={() => setConfirmClear(true)}
                startIcon={<DeleteOutlined />}
                variant="outlined"
              >
                Clear all data
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        confirmLabel="Clear everything"
        description={`This permanently removes ${clearDescription}. Export first if you need a recovery copy.`}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAllStoredData();
          signOut();
          resetCalculator();
          resetTracking();
          resetSettings();
          queryClient.clear();
          setCleared(true);
          setConfirmClear(false);
          setRevision((current) => current + 1);
        }}
        open={confirmClear}
        title="Clear all local data?"
      />
    </Stack>
  );
}
