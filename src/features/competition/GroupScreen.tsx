import { Close, Keyboard, Search } from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  competitorsForGroup,
  createCompetitionBudget,
  extractCompetitionGroups,
} from "../../lib/wca";
import { reconcileLiveBudget, type LiveResults } from "../../lib/wcaLive";
import { EventIcon } from "../../components/EventIcon";
import { useAuthStore } from "../auth/store";
import { liveResultsKey, useLiveResults } from "../live/hooks";
import { activeLiveToken } from "../live/mode";
import { CompetitionState } from "./CompetitionState";
import { CompetitorPanel } from "./CompetitorPanel";
import { CompetitorTable, type CompetitorRow } from "./CompetitorTable";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useCompetitionData } from "./data";
import { trackingBudgetKey, useTrackingStore } from "./trackingStore";
import {
  countryFlag,
  summaryForGroup,
  unsyncedAttemptCount,
} from "./viewModel";

const MAX_SUGGESTIONS = 8;

function foldName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

/** A registrant id matches exactly; anything else matches names containing it. */
function competitorSuggestions(rows: CompetitorRow[], input: string): CompetitorRow[] {
  const needle = input.trim();
  if (needle === "") return [];
  if (/^\d+$/.test(needle)) {
    return rows.filter(({ person }) => String(person.registrantId) === needle);
  }
  const folded = foldName(needle);
  return rows
    .filter(({ person }) => foldName(person.name).includes(folded))
    .slice(0, MAX_SUGGESTIONS);
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  /** True while the field holds typed text; otherwise it shows the open competitor. */
  const [editing, setEditing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
    // Read the cache, not this render's copy: a submission patches it synchronously just
    // before marking the attempt synced, and this effect may run in between.
    const results =
      queryClient.getQueryData<LiveResults>(liveResultsKey(competitionId)) ?? liveResults.data;
    if (!group || !results || !tracking) return;
    for (const person of people) {
      const current = tracking.budgets[trackingBudgetKey(group.key, person.registrantId)];
      if (!current) continue;
      const reconciled = reconcileLiveBudget(current, group, results);
      if (JSON.stringify(reconciled) !== JSON.stringify(current)) {
        replaceBudget(competitionId, reconciled);
      }
    }
  }, [competitionId, group, liveResults.data, people, queryClient, replaceBudget, tracking]);
  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, [contenteditable='true'], [role='dialog']")) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
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
        };
      })
    : [];
  const rows = [...allRows].sort(
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

  const suggestions = competitorSuggestions(rows, search);

  const stopEditing = () => {
    setEditing(false);
    setSearch("");
  };

  const openCompetitor = (registrantId: number) => {
    stopEditing();
    setFocusRequest((current) => current + 1);
    void navigate(competitorPath(registrantId));
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
            <MuiLink
              component={Link}
              to={`/c/${encodeURIComponent(competitionId)}`}
              underline="hover"
              variant="body2"
            >
              {query.data.wcif.name}
            </MuiLink>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={{ xs: 0.5, md: 2 }}
              sx={{ alignItems: { md: "center" }, mt: 0.5 }}
            >
              <Typography
                component="h1"
                sx={{
                  alignItems: "center",
                  columnGap: 1,
                  display: "flex",
                  flexGrow: 1,
                  flexWrap: "wrap",
                  fontSize: { xs: 22, md: 28 },
                  minWidth: 0,
                }}
                variant="h4"
              >
                {group.rounds.map((round, index) => (
                  <Fragment key={round.roundId}>
                    {index > 0 ? (
                      <Box component="span" sx={{ color: "text.secondary" }}>
                        +
                      </Box>
                    ) : null}
                    <Box
                      component="span"
                      sx={{ alignItems: "center", display: "inline-flex", gap: 1 }}
                    >
                      <EventIcon eventId={round.eventId} eventName={round.eventName} size={28} />
                      {round.eventName} · {round.roundLabel}
                    </Box>
                  </Fragment>
                ))}
              </Typography>
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}
              >
                {liveToken && unsynced > 0 ? (
                  <Typography color="warning.main" variant="body2">
                    {unsynced} attempt{unsynced === 1 ? "" : "s"} not on WCA Live
                  </Typography>
                ) : null}
                <Typography color="text.secondary" variant="body2">
                  {rows.length} competitor{rows.length === 1 ? "" : "s"} · sorted by time
                  remaining
                </Typography>
                <Button
                  onClick={() => setShortcutsOpen(true)}
                  size="small"
                  startIcon={<Keyboard />}
                  sx={{ display: { xs: "none", md: "inline-flex" } }}
                >
                  Shortcuts
                </Button>
              </Stack>
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
              // Shared-limit attempts carry a drag handle, badge and arrows around the field, so
              // the scorecard needs more room when the group spans several events.
              gridTemplateColumns:
                group.rounds.length > 1
                  ? {
                      xs: "minmax(0, 1fr)",
                      md: "440px minmax(0, 1fr)",
                      lg: "560px minmax(0, 1fr)",
                    }
                  : { xs: "minmax(0, 1fr)", md: "380px minmax(0, 1fr)" },
            }}
          >
            <Box>
              <Stack spacing={2}>
                <Autocomplete<CompetitorRow>
                  autoHighlight
                  filterOptions={(options) => options}
                  getOptionKey={({ person }) => person.registrantId}
                  getOptionLabel={({ person }) => person.name}
                  inputValue={editing ? search : (selectedPerson?.name ?? "")}
                  noOptionsText="No competitor matches"
                  onChange={(_, row) => {
                    if (row) openCompetitor(row.person.registrantId);
                  }}
                  onBlur={stopEditing}
                  onClose={(_, reason) => {
                    // The list is open whenever there is text, so Escape lands here
                    // rather than on clearOnEscape.
                    if (reason === "escape") stopEditing();
                  }}
                  onInputChange={(_, value, reason) => {
                    if (reason !== "input") return;
                    setEditing(true);
                    setSearch(value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") stopEditing();
                  }}
                  open={editing && search.trim() !== ""}
                  options={suggestions}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      // Opening a round lands in the search; a competitor route focuses their
                      // first empty attempt instead.
                      autoFocus={selectedRegistrantId === null}
                      inputRef={searchRef}
                      label="Competitor"
                      placeholder="Registrant id or name"
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.slotProps.input,
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search aria-hidden="true" />
                            </InputAdornment>
                          ),
                          endAdornment:
                            selectedPerson && !editing ? (
                              <InputAdornment position="end">
                                <Typography color="text.secondary" sx={{ mr: 0.5 }}>
                                  #{selectedPerson.registrantId}
                                </Typography>
                                <IconButton
                                  aria-label="Close competitor"
                                  edge="end"
                                  onClick={() => void navigate(groupPath)}
                                  size="small"
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : (
                              params.slotProps.input.endAdornment
                            ),
                        },
                      }}
                    />
                  )}
                  renderOption={({ key, ...props }, { person }) => (
                    <Box component="li" key={key} {...props}>
                      <Typography sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                        {countryFlag(person.countryIso2)} {person.name}
                      </Typography>
                      <Typography color="text.secondary" sx={{ ml: 2 }} variant="body2">
                        #{person.registrantId}
                      </Typography>
                    </Box>
                  )}
                  value={null}
                />
                {selectedPerson ? (
                  <CompetitorPanel
                    competitionId={competitionId}
                    focusRequest={focusRequest}
                    group={group}
                    liveToken={liveToken}
                    onConfirmed={() => {
                      void navigate(groupPath);
                      searchRef.current?.focus();
                    }}
                    onExit={() => searchRef.current?.focus()}
                    person={selectedPerson}
                  />
                ) : selectedRegistrantId !== null ? (
                  <Alert severity="warning">
                    Registrant #{registrantParam} is not in this group.
                  </Alert>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Type a registrant id and press Enter, or click a row.
                  </Typography>
                )}
              </Stack>
            </Box>

            <Box sx={{ display: { xs: selectedPerson ? "none" : "block", md: "block" } }}>
              <CompetitorTable
                cumulative={group.cumulative}
                linkTo={competitorPath}
                liveMode={liveToken !== null}
                rounds={group.rounds}
                rows={rows}
                selectedRegistrantId={selectedRegistrantId}
              />
            </Box>
          </Box>
          <ShortcutsDialog onClose={() => setShortcutsOpen(false)} open={shortcutsOpen} />
        </Stack>
      ) : query.data ? (
        <Typography>That time-limit group was not found in this competition.</Typography>
      ) : null}
    </CompetitionState>
  );
}
