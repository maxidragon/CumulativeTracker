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
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

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
    action: "Coming in M3",
    to: "/",
    available: false,
  },
] as const;

export function HomeScreen() {
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
                <Button
                  component={Link}
                  disabled={!entry.available}
                  endIcon={entry.available ? <ArrowForward /> : undefined}
                  to={entry.to}
                >
                  {entry.action}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
