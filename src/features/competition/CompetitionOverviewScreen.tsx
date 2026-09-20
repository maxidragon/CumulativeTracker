import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
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
        <Stack spacing={5}>
          <Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
              <Chip color="secondary" label="Local mode" size="small" />
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
            </Stack>
            <Typography component="h1" variant="h2">
              {query.data.wcif.name}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Pick a group to track. Attempts stay in this browser and are not sent anywhere.
            </Typography>
          </Box>

          {session && permissionHint === false && !permissionWarningDismissed ? (
            <Alert onClose={() => setPermissionWarningDismissed(true)} severity="warning">
              We cannot see that you manage this competition. If you are staff with
              scoretaking access, WCA Live may still accept your competition token.
            </Alert>
          ) : null}

          <LiveSetupCard
            competitionId={competitionId}
            liveEnabled={tracking?.liveEnabled ?? false}
            onLiveEnabledChange={(enabled) => setLiveEnabled(competitionId, enabled)}
          />

          {groups.length === 0 ? (
            <Alert severity="info">
              This competition has no supported rounds with a time limit in its public WCIF.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {groups.map((group) => {
                const perAttempt = tracking?.groupSettings[group.key] ?? null;
                return (
                  <Grid key={group.key} size={{ xs: 12, md: 6 }}>
                    <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }} variant="outlined">
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
                          <Chip
                            label={group.cumulative ? "Cumulative" : "Per-attempt only"}
                            size="small"
                            variant="outlined"
                          />
                          <Typography component="h2" variant="h5">
                            {groupTitle(group)}
                          </Typography>
                          <Typography color="text.secondary">
                            {group.cumulative ? "Shared limit" : "Attempt limit"}: {" "}
                            <strong>
                              {formatTime(group.limitCentiseconds, { compact: true })}
                            </strong>
                          </Typography>
                          {group.cumulative ? (
                            <>
                              <TimeSettingField
                                label="Additional per-attempt limit"
                                onCommit={(value) =>
                                  setGroupPerAttemptLimit(competitionId, group.key, value)
                                }
                                optional
                                value={perAttempt}
                              />
                              {perAttempt !== null &&
                              perAttempt > group.limitCentiseconds ? (
                                <Alert severity="warning">
                                  The per-attempt limit cannot be greater than the cumulative
                                  limit.
                                </Alert>
                              ) : null}
                            </>
                          ) : null}
                        </Stack>
                      </CardContent>
                      <CardActions>
                        <Button
                          component={Link}
                          to={`/c/${encodeURIComponent(competitionId)}/g/${encodeURIComponent(group.key)}`}
                          variant="contained"
                        >
                          Open group
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {unsupported.length > 0 ? (
            <Alert severity="info">
              Unsupported rounds are shown but cannot be tracked: {" "}
              {unsupported
                .map(({ eventName, roundNumber }) => `${eventName} Round ${roundNumber}`)
                .join(", ")}.
            </Alert>
          ) : null}
        </Stack>
      ) : null}
    </CompetitionState>
  );
}
