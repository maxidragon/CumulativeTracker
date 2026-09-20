import { ArrowForward, Calculate, Groups } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { readRecentCompetitions } from "../competition/data";

const entryPoints = [
  {
    icon: <Calculate aria-hidden="true" />,
    title: "Quick calculator",
    description:
      "Choose a limit, enter attempts, and always know the cap for the next one.",
    action: "Start calculating",
    to: "/calculator",
    available: true,
  },
  {
    icon: <Groups aria-hidden="true" />,
    title: "Open a competition",
    description:
      "Load public competition data and track a cumulative group locally or with WCA Live.",
    action: "Open below",
    to: "#open-competition",
    available: true,
  },
] as const;

export function HomeScreen() {
  const navigate = useNavigate();
  const [competitionId, setCompetitionId] = useState("");
  const [competitionIdError, setCompetitionIdError] = useState(false);
  const [recent] = useState(readRecentCompetitions);

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
    <Stack spacing={{ xs: 5, md: 8 }}>
      <Box sx={{ maxWidth: 780 }}>
        <Chip color="secondary" label="Built for WCA cumulative limits" size="small" />
        <Typography component="h1" sx={{ mt: 2 }} variant="h1">
          Know exactly how much time is left.
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: { xs: 20, md: 24 }, lineHeight: 1.45, mt: 3 }}
        >
          Track elapsed time, preserve DNF timings, and make the next-attempt cap
          impossible to miss.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {entryPoints.map((entry) => (
          <Grid key={entry.title} size={{ xs: 12, md: 6 }}>
            <Card
              variant="outlined"
              sx={{ display: "flex", flexDirection: "column", height: "100%", p: 1 }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box color="primary.main" sx={{ mb: 2 }}>
                  {entry.icon}
                </Box>
                <Typography component="h2" gutterBottom variant="h5">
                  {entry.title}
                </Typography>
                <Typography color="text.secondary">{entry.description}</Typography>
              </CardContent>
              <CardActions>
                {entry.to.startsWith("#") ? (
                  <Button
                    endIcon={<ArrowForward />}
                    onClick={() =>
                      document.getElementById("open-competition")?.scrollIntoView({
                        behavior: "smooth",
                      })
                    }
                  >
                    {entry.action}
                  </Button>
                ) : (
                  <Button
                    component={Link}
                    disabled={!entry.available}
                    endIcon={entry.available ? <ArrowForward /> : undefined}
                    to={entry.to}
                  >
                    {entry.action}
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box id="open-competition" sx={{ maxWidth: 780, scrollMarginTop: 24 }}>
        <Typography component="h2" gutterBottom variant="h4">
          Open a competition
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Public WCIF data is loaded from the WCA. Sign-in is not required.
        </Typography>
        <Stack
          component="form"
          direction={{ xs: "column", sm: "row" }}
          onSubmit={openCompetition}
          spacing={2}
        >
          <TextField
            error={competitionIdError}
            fullWidth
            helperText={competitionIdError ? "Enter a WCA competition id." : undefined}
            label="Competition id"
            onChange={(event) => {
              setCompetitionId(event.target.value);
              setCompetitionIdError(false);
            }}
            placeholder="ExampleOpen2026"
            value={competitionId}
          />
          <Button type="submit" variant="contained">
            Open
          </Button>
        </Stack>

        {recent.length > 0 ? (
          <Box sx={{ mt: 4 }}>
            <Typography color="text.secondary" gutterBottom variant="overline">
              Recent competitions
            </Typography>
            <Stack spacing={1}>
              {recent.map((competition) => (
                <Button
                  component={Link}
                  key={competition.id}
                  sx={{ justifyContent: "flex-start" }}
                  to={`/c/${encodeURIComponent(competition.id)}`}
                  variant="outlined"
                >
                  {competition.name}
                </Button>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}
