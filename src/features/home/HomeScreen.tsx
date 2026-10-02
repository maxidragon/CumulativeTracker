import { ArrowForward, Calculate } from "@mui/icons-material";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { readRecentCompetitions } from "../competition/data";
import { useManagedCompetitions } from "../auth/api";
import { useAuthStore } from "../auth/store";

function CompetitionList({
  title,
  competitions,
}: {
  title: string;
  competitions: { id: string; name: string }[];
}) {
  return (
    <Box>
      <Typography color="text.secondary" variant="overline">
        {title}
      </Typography>
      <Paper variant="outlined">
        <List disablePadding>
          {competitions.map((competition) => (
            <ListItemButton
              component={Link}
              divider
              key={competition.id}
              to={`/c/${encodeURIComponent(competition.id)}`}
            >
              <ListItemText primary={competition.name} secondary={competition.id} />
              <ArrowForward aria-hidden="true" color="action" fontSize="small" />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [competitionId, setCompetitionId] = useState("");
  const [competitionIdError, setCompetitionIdError] = useState(false);
  const [recent] = useState(readRecentCompetitions);
  const session = useAuthStore((state) => state.session);
  const managed = useManagedCompetitions();

  const openCompetition = (event: FormEvent) => {
    event.preventDefault();
    const normalized = competitionId.trim();
    if (!/^[A-Za-z0-9]+$/.test(normalized)) {
      setCompetitionIdError(true);
      return;
    }
    void navigate(`/c/${encodeURIComponent(normalized)}`);
  };

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 4, md: 6 },
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 1fr)" },
        maxWidth: 1100,
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography component="h1" variant="h4">
            Open a competition
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Track WCA cumulative time limits for every competitor in a group. Public
            competition data is loaded from the WCA; sign-in is only needed for WCA Live.
          </Typography>
        </Box>
        <Stack
          component="form"
          direction={{ xs: "column", sm: "row" }}
          onSubmit={openCompetition}
          spacing={1}
          sx={{ alignItems: { sm: "flex-start" } }}
        >
          <TextField
            autoFocus
            error={competitionIdError}
            fullWidth
            helperText={
              competitionIdError
                ? "Enter a WCA competition id."
                : "The id from the competition's WCA page URL."
            }
            label="Competition id"
            onChange={(event) => {
              setCompetitionId(event.target.value);
              setCompetitionIdError(false);
            }}
            placeholder="ExampleOpen2026"
            value={competitionId}
          />
          <Button sx={{ minHeight: 56, px: 4 }} type="submit" variant="contained">
            Open
          </Button>
        </Stack>

        {session && managed.data && managed.data.length > 0 ? (
          <CompetitionList competitions={managed.data} title="Competitions you manage" />
        ) : null}
        {session && managed.isError ? (
          <Typography color="error" variant="body2">
            Managed competitions could not be loaded. You can still enter an id above.
          </Typography>
        ) : null}
        {recent.length > 0 ? (
          <CompetitionList competitions={recent} title="Recent competitions" />
        ) : null}
      </Stack>

      <Paper sx={{ alignSelf: "start", p: 3 }} variant="outlined">
        <Calculate aria-hidden="true" color="primary" />
        <Typography component="h2" sx={{ mt: 1 }} variant="h6">
          Quick calculator
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          No competition, no login: a limit, some attempts, and the cap for the next one.
        </Typography>
        <Button component={Link} endIcon={<ArrowForward />} to="/calculator" variant="outlined">
          Start calculating
        </Button>
      </Paper>
    </Box>
  );
}
