import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  forgetScoretakingToken,
  isScoretakingTokenExpired,
  maskScoretakingToken,
  readScoretakingToken,
  saveScoretakingToken,
} from "../../lib/wcaLive";
import { useAuthStore } from "../auth/store";

type LiveSetupCardProps = {
  competitionId: string;
  liveEnabled: boolean;
  onLiveEnabledChange: (enabled: boolean) => void;
};

export function LiveSetupCard({
  competitionId,
  liveEnabled,
  onLiveEnabledChange,
}: LiveSetupCardProps) {
  const session = useAuthStore((state) => state.session);
  const [storedToken, setStoredToken] = useState(() =>
    readScoretakingToken(competitionId),
  );
  const [draftToken, setDraftToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const expired = storedToken ? isScoretakingTokenExpired(storedToken) : false;
  const canUseLive = Boolean(session && storedToken && !expired);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <BoxTitle />
          <ToggleButtonGroup
            exclusive
            fullWidth
            onChange={(_event, value: "local" | "live" | null) => {
              if (value) onLiveEnabledChange(value === "live");
            }}
            value={liveEnabled ? "live" : "local"}
          >
            <ToggleButton value="local">Local only</ToggleButton>
            <ToggleButton disabled={!canUseLive} value="live">
              WCA Live
            </ToggleButton>
          </ToggleButtonGroup>

          {!session ? (
            <Alert severity="info">Sign in with WCA to configure WCA Live submission.</Alert>
          ) : storedToken ? (
            <Stack spacing={1}>
              <Typography>
                Token: <strong>{maskScoretakingToken(storedToken.token)}</strong>
              </Typography>
              {expired ? (
                <Alert severity="warning">
                  This token is more than seven days old. Generate and paste a new token.
                </Alert>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  Stored only in this browser for {competitionId}.
                </Typography>
              )}
              <Button
                color="error"
                onClick={() => {
                  forgetScoretakingToken(competitionId);
                  setStoredToken(null);
                  onLiveEnabledChange(false);
                }}
                sx={{ alignSelf: "flex-start" }}
              >
                Forget token
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <TextField
                error={tokenError !== null}
                helperText={
                  tokenError ??
                  "Generate this on your WCA Live account page. It is valid for seven days."
                }
                label="WCA Live scoretaking token"
                onChange={(event) => {
                  setDraftToken(event.target.value);
                  setTokenError(null);
                }}
                type="password"
                value={draftToken}
              />
              <Button
                onClick={() => {
                  try {
                    const token = saveScoretakingToken(competitionId, draftToken);
                    setStoredToken(token);
                    setDraftToken("");
                    setTokenError(null);
                  } catch (error) {
                    setTokenError(
                      error instanceof Error ? error.message : "The token could not be saved.",
                    );
                  }
                }}
                sx={{ alignSelf: "flex-start" }}
                variant="contained"
              >
                Save token
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function BoxTitle() {
  return (
    <div>
      <Typography component="h2" variant="h5">
        Tracking mode
      </Typography>
      <Typography color="text.secondary">
        Local mode never sends results. WCA Live mode submits acknowledged attempts one at a
        time.
      </Typography>
    </div>
  );
}
