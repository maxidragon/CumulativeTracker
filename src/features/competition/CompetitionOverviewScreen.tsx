import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatTime } from "../../lib/attempt";
import {
  extractCompetitionGroups,
  groupTitle,
  unsupportedRounds,
} from "../../lib/wca";
import { TimeSettingField } from "../calculator/TimeSettingField";
import {
  hasCompetitionPermissionHint,
  useCurrentUser,
  useManagedCompetitions,
} from "../auth/api";
import { useAuthStore } from "../auth/store";
import { LiveSetupCard } from "../live/LiveSetupCard";
import { CompetitionState } from "./CompetitionState";
import { cacheAge, useCompetitionData } from "./data";
import { useTrackingStore } from "./trackingStore";

export function CompetitionOverviewScreen() {
  const { competitionId = "" } = useParams();
  const query = useCompetitionData(competitionId);
  const loadCompetition = useTrackingStore((state) => state.loadCompetition);
  const setGroupPerAttemptLimit = useTrackingStore(
    (state) => state.setGroupPerAttemptLimit,
  );
  const setLiveEnabled = useTrackingStore((state) => state.setLiveEnabled);
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
  const session = useAuthStore((state) => state.session);
  const currentUser = useCurrentUser();
  const managedCompetitions = useManagedCompetitions();
  const [permissionWarningDismissed, setPermissionWarningDismissed] = useState(false);

  useEffect(() => loadCompetition(competitionId), [competitionId, loadCompetition]);

  const groups = query.data ? extractCompetitionGroups(query.data.wcif) : [];
  const unsupported = query.data ? unsupportedRounds(query.data.wcif) : [];
  const permissionHint =
    query.data && currentUser.data && !managedCompetitions.isLoading
      ? hasCompetitionPermissionHint(
          currentUser.data,
          query.data.wcif,
          managedCompetitions.data ?? [],
        )
      : null;

  return (
    <CompetitionState
      data={query.data}
      error={query.error}
      isLoading={query.isLoading}
      onRetry={() => void query.refetch()}
    >
      {query.data ? (
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              {query.data.wcif.name}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1 }}>
              {tracking?.liveEnabled ? (
                <Chip color="primary" label="WCA Live mode" size="small" />
              ) : (
                <Chip color="secondary" label="Local mode" size="small" />
              )}
              {permissionHint ? (
                <Chip color="success" label="Competition manager" size="small" />
              ) : null}
              {query.data.fromCache ? (
                <Chip
                  color="warning"
                  label={`Cached data · ${cacheAge(query.data.fetchedAt)}`}
                  size="small"
                />
              ) : null}
              <Typography color="text.secondary" variant="body2">
                Pick the time-limit group you are scoretaking.
              </Typography>
            </Stack>
          </Box>

          {session && permissionHint === false && !permissionWarningDismissed ? (
            <Alert onClose={() => setPermissionWarningDismissed(true)} severity="warning">
              We cannot see that you manage this competition. If you are staff with
              scoretaking access, WCA Live may still accept your competition token.
            </Alert>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gap: 3,
              alignItems: "start",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "minmax(0, 2fr) minmax(0, 1fr)",
              },
            }}
          >
            <Stack spacing={2}>
              {groups.length === 0 ? (
                <Alert severity="info">
                  This competition has no supported rounds with a time limit in its public
                  WCIF.
                </Alert>
              ) : (
                groups.map((group) => {
                  const perAttempt = tracking?.groupSettings[group.key] ?? null;
                  return (
                    <Paper key={group.key} sx={{ p: 2 }} variant="outlined">
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        sx={{ alignItems: { sm: "center" } }}
                      >
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography component="h2" sx={{ fontWeight: 700 }} variant="h6">
                            {groupTitle(group)}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            {group.cumulative ? "Cumulative limit" : "Per-attempt limit only"}{" "}
                            <strong>
                              {formatTime(group.limitCentiseconds, { compact: true })}
                            </strong>
                          </Typography>
                        </Box>
                        {group.cumulative ? (
                          <Box sx={{ width: { sm: 220 } }}>
                            <TimeSettingField
                              label="Per-attempt limit"
                              onCommit={(value) =>
                                setGroupPerAttemptLimit(competitionId, group.key, value)
                              }
                              optional
                              value={perAttempt}
                            />
                          </Box>
                        ) : null}
                        <Button
                          component={Link}
                          sx={{ flexShrink: 0 }}
                          to={`/c/${encodeURIComponent(competitionId)}/g/${encodeURIComponent(group.key)}`}
                          variant="contained"
                        >
                          Open group
                        </Button>
                      </Stack>
                      {perAttempt !== null && perAttempt > group.limitCentiseconds ? (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          The per-attempt limit cannot be greater than the cumulative limit.
                        </Alert>
                      ) : null}
                    </Paper>
                  );
                })
              )}

              {unsupported.length > 0 ? (
                <Typography color="text.secondary" variant="body2">
                  Not trackable here:{" "}
                  {unsupported
                    .map(({ eventName, roundNumber }) => `${eventName} Round ${roundNumber}`)
                    .join(", ")}
                  .
                </Typography>
              ) : null}
            </Stack>

            <LiveSetupCard
              competitionId={competitionId}
              liveEnabled={tracking?.liveEnabled ?? false}
              onLiveEnabledChange={(enabled) => setLiveEnabled(competitionId, enabled)}
            />
          </Box>
        </Stack>
      ) : null}
    </CompetitionState>
  );
}
