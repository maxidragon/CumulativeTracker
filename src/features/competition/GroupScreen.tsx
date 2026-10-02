import { Search } from "@mui/icons-material";
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
  groupTitle,
  plansForCompetitor,
} from "../../lib/wca";
import { reconcileLiveBudget } from "../../lib/wcaLive";
import { useAuthStore } from "../auth/store";
import { useLiveResults } from "../live/hooks";
import { activeLiveToken } from "../live/mode";
import { CompetitionState } from "./CompetitionState";
import { CompetitorPanel } from "./CompetitorPanel";
import { CompetitorTable, type CompetitorRow } from "./CompetitorTable";
import { useCompetitionData } from "./data";
import { trackingBudgetKey, useTrackingStore } from "./trackingStore";
import { competitorStatus, summaryForGroup, unsyncedAttemptCount } from "./viewModel";

function matchesSearch({ person }: CompetitorRow, needle: string): boolean {
  return (
    needle === "" ||
    person.name.toLocaleLowerCase().includes(needle) ||
    String(person.registrantId).includes(needle)
  );
}

/**
 * The scoretaking workspace: every competitor in a group, and — once one is picked — their
 * attempts beside the table. Serves both the group route and the competitor route so moving
 * between scorecards never remounts the table.
 */
export function GroupScreen() {
  const { competitionId = "", groupKey = "", registrantId: registrantParam } = useParams();
  const selectedRegistrantId = registrantParam === undefined ? null : Number(registrantParam);
  const navigate = useNavigate();
  const query = useCompetitionData(competitionId);
  const loadCompetition = useTrackingStore((state) => state.loadCompetition);
  const ensureBudgets = useTrackingStore((state) => state.ensureBudgets);
  const replaceBudget = useTrackingStore((state) => state.replaceBudget);
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
  const session = useAuthStore((state) => state.session);
  const liveToken = activeLiveToken(competitionId, tracking, session);
  const liveResults = useLiveResults(competitionId, liveToken !== null);
  const [search, setSearch] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const group = query.data
    ? extractCompetitionGroups(query.data.wcif).find(({ key }) => key === groupKey)
    : undefined;
  const perAttemptLimit = group ? (tracking?.groupSettings[group.key] ?? null) : null;
  const people = useMemo(
    () => (query.data && group ? competitorsForGroup(query.data.wcif, group) : []),
    [group, query.data],
  );
  const defaultBudgets = useMemo(
    () =>
      group
        ? people.map((person) => createCompetitionBudget(person, group, perAttemptLimit))
        : [],
    [group, people, perAttemptLimit],
  );

  useEffect(() => loadCompetition(competitionId), [competitionId, loadCompetition]);
  useEffect(() => {
    if (defaultBudgets.length > 0) ensureBudgets(competitionId, defaultBudgets);
  }, [competitionId, defaultBudgets, ensureBudgets]);
  useEffect(() => {
    if (!group || !liveResults.data || !tracking) return;
    for (const person of people) {
      const current = tracking.budgets[trackingBudgetKey(group.key, person.registrantId)];
      if (!current) continue;
      const reconciled = reconcileLiveBudget(current, group, liveResults.data);
      if (JSON.stringify(reconciled) !== JSON.stringify(current)) {
        replaceBudget(competitionId, reconciled);
      }
    }
  }, [competitionId, group, liveResults.data, people, replaceBudget, tracking]);
  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.key === "/" && !target?.closest("input, textarea, [contenteditable='true']")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const groupPath = `/c/${encodeURIComponent(competitionId)}/g/${encodeURIComponent(groupKey)}`;
  const competitorPath = (registrantId: number) => `${groupPath}/${registrantId}`;

  const allRows: CompetitorRow[] = group
    ? people.map((person) => {
        const budget =
          tracking?.budgets[trackingBudgetKey(group.key, person.registrantId)] ??
          createCompetitionBudget(person, group, perAttemptLimit);
        return {
          person,
          budget,
          summary: summaryForGroup(group, budget),
          status: competitorStatus(group, budget, plansForCompetitor(person, group)),
        };
      })
    : [];
  const needle = search.trim().toLocaleLowerCase();
  const rows = allRows
    .filter((row) => matchesSearch(row, needle))
    .sort(
      (left, right) =>
        left.summary.remainingCentiseconds - right.summary.remainingCentiseconds ||
        left.person.name.localeCompare(right.person.name),
    );
  const selectedPerson = allRows.find(
    ({ person }) => person.registrantId === selectedRegistrantId,
  )?.person;
  const unsynced = liveToken
    ? allRows.reduce((total, { budget }) => total + unsyncedAttemptCount(budget), 0)
    : 0;

  const openFromSearch = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearch("");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const match =
      rows.find(({ person }) => String(person.registrantId) === needle) ?? rows[0];
    if (!match) return;
    setSearch("");
    setFocusRequest((current) => current + 1);
    void navigate(competitorPath(match.person.registrantId));
  };

  return (
    <CompetitionState
      data={query.data}
      error={query.error}
      isLoading={query.isLoading}
      onRetry={() => void query.refetch()}
    >
      {query.data && group ? (
        <Stack spacing={3}>
          <Box>
            <Breadcrumbs sx={{ mb: 0.5 }}>
              <MuiLink
                component={Link}
                to={`/c/${encodeURIComponent(competitionId)}`}
                underline="hover"
              >
                {query.data.wcif.name}
              </MuiLink>
              <Typography color="text.secondary">Group</Typography>
            </Breadcrumbs>
            <Typography component="h1" sx={{ fontSize: { xs: 24, md: 34 } }} variant="h4">
              {groupTitle(group)}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1 }}>
              {liveToken ? <Chip color="primary" label="WCA Live mode" size="small" /> : null}
              {liveToken && unsynced > 0 ? (
                <Chip
                  color="warning"
                  label={`${unsynced} attempt${unsynced === 1 ? "" : "s"} not on WCA Live`}
                  size="small"
                  variant="outlined"
                />
              ) : null}
              <Typography color="text.secondary" variant="body2">
                {rows.length} competitor{rows.length === 1 ? "" : "s"} · sorted by time
                remaining
              </Typography>
            </Stack>
          </Box>

          {liveToken && liveResults.isError ? (
            <Alert severity="warning">
              WCA Live results could not be refreshed. Local entry remains available.
            </Alert>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gap: 3,
              alignItems: "start",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "380px minmax(0, 1fr)",
              },
            }}
          >
            <Paper sx={{ p: { xs: 2, md: 3 } }} variant="outlined">
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  helperText="Registrant id or name, then Enter. Press / to jump here."
                  inputRef={searchRef}
                  label="Find competitor (registrant id or name)"
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={openFromSearch}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search aria-hidden="true" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  value={search}
                />
                {selectedPerson ? (
                  <CompetitorPanel
                    closeTo={groupPath}
                    competitionId={competitionId}
                    focusRequest={focusRequest}
                    group={group}
                    liveToken={liveToken}
                    onDone={() => searchRef.current?.focus()}
                    person={selectedPerson}
                  />
                ) : selectedRegistrantId !== null ? (
                  <Alert severity="warning">
                    Registrant #{registrantParam} is not in this group.
                  </Alert>
                ) : (
                  <Typography color="text.secondary">
                    Pick a competitor to enter their attempts: type their registrant id above,
                    or click their row in the table.
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Box sx={{ display: { xs: selectedPerson ? "none" : "block", md: "block" } }}>
              <CompetitorTable
                cumulative={group.cumulative}
                linkTo={competitorPath}
                liveMode={liveToken !== null}
                rounds={group.rounds}
                rows={rows}
                selectedRegistrantId={selectedRegistrantId}
              />
              {rows.length === 0 ? (
                <Typography color="text.secondary">No competitors match this search.</Typography>
              ) : null}
            </Box>
          </Box>
        </Stack>
      ) : query.data ? (
        <Typography>That time-limit group was not found in this competition.</Typography>
      ) : null}
    </CompetitionState>
  );
}
