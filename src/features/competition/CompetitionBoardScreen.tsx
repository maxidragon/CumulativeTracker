import { Search } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatTime } from "../../lib/attempt";
import { attemptsLeft } from "../../lib/cumulative";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
  groupTitle,
  plansForCompetitor,
} from "../../lib/wca";
import { CompetitionState } from "./CompetitionState";
import { useAuthStore } from "../auth/store";
import { activeLiveToken } from "../live/mode";
import { useLiveResults } from "../live/hooks";
import { reconcileLiveBudget } from "../../lib/wcaLive";
import { useCompetitionData } from "./data";
import {
  trackingBudgetKey,
  useTrackingStore,
} from "./trackingStore";
import {
  competitorStatus,
  budgetSyncLabel,
  countryFlag,
  formatAttemptChip,
  summaryForGroup,
} from "./viewModel";

const statusColor = {
  "Not started": "default",
  "On track": "success",
  Tight: "warning",
  Exhausted: "error",
  Incomplete: "warning",
} as const;

export function CompetitionBoardScreen() {
  const { competitionId = "", groupKey = "" } = useParams();
  const query = useCompetitionData(competitionId);
  const loadCompetition = useTrackingStore((state) => state.loadCompetition);
  const ensureBudgets = useTrackingStore((state) => state.ensureBudgets);
  const tracking = useTrackingStore((state) => state.competitions[competitionId]);
  const replaceBudget = useTrackingStore((state) => state.replaceBudget);
  const session = useAuthStore((state) => state.session);
  const liveToken = activeLiveToken(competitionId, tracking, session);
  const liveResults = useLiveResults(competitionId, liveToken !== null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const group = query.data
    ? extractCompetitionGroups(query.data.wcif).find(({ key }) => key === groupKey)
    : undefined;
  const people = useMemo(
    () => (query.data && group ? competitorsForGroup(query.data.wcif, group) : []),
    [group, query.data],
  );
  const defaultBudgets = useMemo(
    () =>
      group
        ? people.map((person) =>
            createCompetitionBudget(
              person,
              group,
              tracking?.groupSettings[group.key] ?? null,
            ),
          )
        : [],
    [group, people, tracking?.groupSettings],
  );

  useEffect(() => loadCompetition(competitionId), [competitionId, loadCompetition]);
  useEffect(() => {
    if (defaultBudgets.length > 0) ensureBudgets(competitionId, defaultBudgets);
  }, [competitionId, defaultBudgets, ensureBudgets]);
  useEffect(() => {
    if (!group || !liveResults.data || !tracking) return;
    for (const person of people) {
      const key = trackingBudgetKey(group.key, person.registrantId);
      const current = tracking.budgets[key];
      if (!current) continue;
      const reconciled = reconcileLiveBudget(current, group, liveResults.data);
      if (JSON.stringify(reconciled) !== JSON.stringify(current)) {
        replaceBudget(competitionId, reconciled);
      }
    }
  }, [competitionId, group, liveResults.data, people, replaceBudget, tracking]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        event.key === "/" &&
        !target?.closest("input, textarea, [contenteditable='true']")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const rows = group
    ? people
        .map((person) => {
          const fallback = createCompetitionBudget(
            person,
            group,
            tracking?.groupSettings[group.key] ?? null,
          );
          const budget =
            tracking?.budgets[trackingBudgetKey(group.key, person.registrantId)] ?? fallback;
          const summary = summaryForGroup(group, budget);
          const plans = plansForCompetitor(person, group);
          return {
            person,
            budget,
            summary,
            attemptsLeft: attemptsLeft(plans, budget.attempts),
            status: competitorStatus(group, budget, plans),
          };
        })
        .filter(({ person }) => {
          const needle = search.trim().toLocaleLowerCase();
          return (
            needle === "" ||
            person.name.toLocaleLowerCase().includes(needle) ||
            String(person.registrantId).includes(needle)
          );
        })
        .sort(
          (left, right) =>
            left.summary.remainingCentiseconds - right.summary.remainingCentiseconds ||
            left.person.name.localeCompare(right.person.name),
        )
    : [];

  return (
    <CompetitionState
      data={query.data}
      error={query.error}
      isLoading={query.isLoading}
      onRetry={() => void query.refetch()}
    >
      {query.data && group ? (
        <Stack spacing={4}>
          <Box>
            <Typography color="primary" sx={{ fontWeight: 800 }} variant="overline">
              {query.data.wcif.name}
            </Typography>
            <Typography component="h1" variant="h2">
              {groupTitle(group)}
            </Typography>
            {liveToken ? <Chip color="primary" label="WCA Live mode" size="small" /> : null}
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {rows.length} competitor{rows.length === 1 ? "" : "s"} · sorted by time
              remaining
            </Typography>
          </Box>

          <TextField
            inputRef={searchRef}
            label="Search name or registrant id"
            onChange={(event) => setSearch(event.target.value)}
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

          {liveToken && liveResults.isError ? (
            <Alert severity="warning">
              WCA Live results could not be refreshed. Local entry remains available.
            </Alert>
          ) : null}

          <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Competitor</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell align="right">Used</TableCell>
                  <TableCell align="right">Remaining</TableCell>
                  <TableCell align="right">Next cap</TableCell>
                  <TableCell>Status</TableCell>
                  {liveToken ? <TableCell>Sync</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ person, budget, summary, status }) => (
                  <TableRow hover key={person.registrantId}>
                    <TableCell>
                      <Button
                        component={Link}
                        sx={{ justifyContent: "flex-start", textAlign: "left" }}
                        to={`${person.registrantId}`}
                      >
                        {countryFlag(person.countryIso2)} {person.name}
                        <Typography color="text.secondary" variant="caption">
                          {` · #${person.registrantId}`}
                        </Typography>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        {budget.attempts.map((attempt) => (
                          <Chip
                            key={`${attempt.roundId}:${attempt.attemptNumber}`}
                            label={formatAttemptChip(attempt)}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {formatTime(summary.usedCentiseconds, { compact: true })}
                    </TableCell>
                    <TableCell align="right">
                      {group.cumulative
                        ? `${summary.isUpperBound ? "≤ " : ""}${formatTime(Math.max(0, summary.remainingCentiseconds), { compact: true })}`
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {formatTime(
                        Math.max(0, summary.capForNextAttemptCentiseconds),
                        { compact: true },
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip color={statusColor[status]} label={status} size="small" />
                    </TableCell>
                    {liveToken ? <TableCell>{budgetSyncLabel(budget)}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack spacing={2} sx={{ display: { xs: "flex", md: "none" } }}>
            {rows.map(({ person, budget, summary, status }) => (
              <Card key={person.registrantId} variant="outlined">
                <CardActionArea component={Link} to={`${person.registrantId}`}>
                  <CardContent>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {countryFlag(person.countryIso2)} {person.name}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          Registrant #{person.registrantId}
                        </Typography>
                      </Box>
                      <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
                        <Chip color={statusColor[status]} label={status} size="small" />
                        {liveToken ? (
                          <Typography color="text.secondary" variant="caption">
                            {budgetSyncLabel(budget)}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                      <Box>
                        <Typography color="text.secondary" variant="caption">
                          Remaining
                        </Typography>
                        <Typography
                          sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
                        >
                          {group.cumulative
                            ? `${summary.isUpperBound ? "≤ " : ""}${formatTime(Math.max(0, summary.remainingCentiseconds), { compact: true })}`
                            : "—"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography color="text.secondary" variant="caption">
                          Next cap
                        </Typography>
                        <Typography
                          sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
                        >
                          {formatTime(
                            Math.max(0, summary.capForNextAttemptCentiseconds),
                            { compact: true },
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
          {rows.length === 0 ? (
            <Typography color="text.secondary">No competitors match this search.</Typography>
          ) : null}
        </Stack>
      ) : query.data ? (
        <Typography>That time-limit group was not found in this competition.</Typography>
      ) : null}
    </CompetitionState>
  );
}
