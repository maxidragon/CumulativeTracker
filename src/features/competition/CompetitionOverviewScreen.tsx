import { Close, Podcasts } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EventIcon } from "../../components/EventIcon";
import { formatTime } from "../../lib/attempt";
import { extractCompetitionGroups, type CompetitionGroup } from "../../lib/wca";
import {
  hasCompetitionPermissionHint,
  useCurrentUser,
  useManagedCompetitions,
} from "../auth/api";
import { useAuthStore } from "../auth/store";
import { LiveSetup } from "../live/LiveSetup";
import { CompetitionState } from "./CompetitionState";
import { useCompetitionData } from "./data";
import { useTrackingStore } from "./trackingStore";

function GroupCard({
  competitionId,
  group,
}: {
  competitionId: string;
  group: CompetitionGroup;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea
        component={Link}
        sx={{ height: "100%", p: 2 }}
        to={`/c/${encodeURIComponent(competitionId)}/g/${encodeURIComponent(group.key)}`}
      >
        <Typography component="p" sx={{ fontWeight: 700 }} variant="h5">
          {formatTime(group.limitCentiseconds)}
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", m: 0, mt: 1, p: 0 }}>
          {group.rounds.map((round) => (
            <Stack
              component="li"
              direction="row"
              key={round.roundId}
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <EventIcon eventId={round.eventId} eventName={round.eventName} />
              <Typography variant="body2">
                {round.eventName} · {round.roundLabel}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function CompetitionOverviewScreen() {
  const { competitionId = "" } = useParams();
  const query = useCompetitionData(competitionId);
  const loadCompetition = useTrackingStore((state) => state.loadCompetition);
  const setLiveEnabled = useTrackingStore((state) => state.setLiveEnabled);
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
  const session = useAuthStore((state) => state.session);
  const currentUser = useCurrentUser();
  const managedCompetitions = useManagedCompetitions();
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);

  useEffect(() => loadCompetition(competitionId), [competitionId, loadCompetition]);

  const groups = query.data
    ? extractCompetitionGroups(query.data.wcif).filter(({ cumulative }) => cumulative)
    : [];
  const permissionHint =
    query.data && currentUser.data && !managedCompetitions.isLoading
      ? hasCompetitionPermissionHint(
          currentUser.data,
          query.data.wcif,
          managedCompetitions.data ?? [],
        )
      : null;
  const liveEnabled = tracking?.liveEnabled ?? false;

  return (
    <CompetitionState
      data={query.data}
      error={query.error}
      isLoading={query.isLoading}
      onRetry={() => void query.refetch()}
    >
      {query.data ? (
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Typography component="h1" sx={{ flexGrow: 1, minWidth: 0 }} variant="h4">
              {query.data.wcif.name}
            </Typography>
            <Button
              color={liveEnabled ? "primary" : "inherit"}
              onClick={() => setLiveDialogOpen(true)}
              startIcon={<Podcasts />}
              sx={{ flexShrink: 0 }}
              variant="outlined"
            >
              {liveEnabled ? "WCA Live on" : "WCA Live off"}
            </Button>
          </Stack>

          {groups.length === 0 ? (
            <Typography color="text.secondary">
              This competition has no cumulative time limits.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {groups.map((group) => (
                <GroupCard competitionId={competitionId} group={group} key={group.key} />
              ))}
            </Box>
          )}

          <Dialog
            fullWidth
            maxWidth="sm"
            onClose={() => setLiveDialogOpen(false)}
            open={liveDialogOpen}
          >
            <DialogTitle sx={{ pr: 7 }}>WCA Live</DialogTitle>
            <IconButton
              aria-label="Close"
              onClick={() => setLiveDialogOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
            <DialogContent>
              <Stack spacing={2}>
                {session && permissionHint === false ? (
                  <Alert severity="warning">
                    We cannot see that you manage this competition. If you are staff with
                    scoretaking access, WCA Live may still accept your competition token.
                  </Alert>
                ) : null}
                <LiveSetup
                  competitionId={competitionId}
                  liveEnabled={liveEnabled}
                  onLiveEnabledChange={(enabled) => setLiveEnabled(competitionId, enabled)}
                />
              </Stack>
            </DialogContent>
          </Dialog>
        </Stack>
      ) : null}
    </CompetitionState>
  );
}
