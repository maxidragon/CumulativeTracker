import { Search } from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchCompetitions, type CompetitionSummary } from "../../lib/wca";
import { useManagedCompetitions } from "../auth/api";
import { useAuthStore } from "../auth/store";
import { readRecentCompetitions } from "../competition/data";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

const MANAGED_LOOKBACK_DAYS = 7;

type CompetitionOption = {
  id: string;
  name: string;
  detail?: string;
  group?: string;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const regionNames = new Intl.DisplayNames(undefined, { type: "region" });

function describeCompetition({ city, countryIso2, startDate, endDate }: CompetitionSummary) {
  const country = regionNames.of(countryIso2) ?? countryIso2;
  const dates = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  return `${city}, ${country} · ${dates}`;
}

/** Competitions that ended at most a week ago, soonest first. */
function currentCompetitions(competitions: CompetitionSummary[]): CompetitionSummary[] {
  const cutoff = new Date(Date.now() - MANAGED_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return competitions
    .filter(({ endDate }) => endDate >= cutoff)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [recent] = useState(readRecentCompetitions);
  const session = useAuthStore((state) => state.session);
  const managed = useManagedCompetitions();
  const query = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS);
  const searching = query.length >= MIN_QUERY_LENGTH;

  const search = useQuery({
    queryKey: ["wca", "competition-search", query],
    queryFn: ({ signal }) => searchCompetitions(query, signal),
    enabled: searching,
    staleTime: 60_000,
  });

  const managedCurrent = useMemo(
    () => currentCompetitions(managed.data ?? []),
    [managed.data],
  );

  const shortcuts = useMemo<CompetitionOption[]>(
    () =>
      recent.map((competition) => ({ ...competition, group: "Recent" })),
    [recent],
  );

  const options: CompetitionOption[] = searching
    ? (search.data ?? []).map((competition) => ({
        id: competition.id,
        name: competition.name,
        detail: describeCompetition(competition),
      }))
    : shortcuts;

  const open = (competitionId: string) => {
    void navigate(`/c/${encodeURIComponent(competitionId)}`);
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography component="h1" sx={{ mb: 2 }} variant="h5">
        Find a competition
      </Typography>
      <Autocomplete<CompetitionOption, false, false, true>
        filterOptions={(candidates) => candidates}
        freeSolo
        getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
        groupBy={searching ? undefined : (option) => option.group ?? ""}
        inputValue={input}
        loading={searching && search.isFetching}
        noOptionsText={search.isError ? "Search failed. Enter a competition id instead." : "No competitions found"}
        onChange={(_, value) => {
          if (typeof value === "string") {
            if (/^[A-Za-z0-9]+$/.test(value.trim())) open(value.trim());
          } else if (value) {
            open(value.id);
          }
        }}
        onInputChange={(_, value) => setInput(value)}
        options={options}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            placeholder="Competition name or id"
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, "aria-label": "Search competitions" },
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <Search aria-hidden="true" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {searching && search.isFetching ? <CircularProgress size={20} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
        renderOption={({ key, ...props }, option) => (
          <Box component="li" key={key} {...props}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap>{option.name}</Typography>
              {option.detail ? (
                <Typography color="text.secondary" noWrap variant="body2">
                  {option.detail}
                </Typography>
              ) : null}
            </Box>
          </Box>
        )}
      />

      {session && managedCurrent.length > 0 ? (
        <Box sx={{ mt: 5 }}>
          <Typography component="h2" sx={{ mb: 1 }} variant="subtitle1">
            Your competitions
          </Typography>
          <Paper variant="outlined">
            <List disablePadding>
              {managedCurrent.map((competition, index) => (
                <ListItemButton
                  component={Link}
                  divider={index < managedCurrent.length - 1}
                  key={competition.id}
                  to={`/c/${encodeURIComponent(competition.id)}`}
                >
                  <ListItemText
                    primary={competition.name}
                    secondary={describeCompetition(competition)}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
      ) : null}
      {session && managed.isError ? (
        <Typography color="error" sx={{ mt: 3 }} variant="body2">
          Your competitions could not be loaded from the WCA.
        </Typography>
      ) : null}
    </Box>
  );
}
