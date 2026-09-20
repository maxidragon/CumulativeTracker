import { AccountCircle } from "@mui/icons-material";
import { Alert, Button, CircularProgress, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect } from "react";
import { beginWcaSignIn, oauthClientId } from "./oauth";
import { useCurrentUser } from "./api";
import { useAuthStore } from "./store";

export function AuthControls() {
  const session = useAuthStore((state) => state.session);
  const setError = useAuthStore((state) => state.setError);
  const signOut = useAuthStore((state) => state.signOut);
  const expireSession = useAuthStore((state) => state.expireSession);
  const user = useCurrentUser();
  const configured = oauthClientId() !== "";

  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining <= 0) {
      expireSession();
      return;
    }
    const timer = window.setTimeout(expireSession, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [expireSession, session]);

  if (!session) {
    const button = (
      <Button
        color="inherit"
        disabled={!configured}
        onClick={() => {
          try {
            beginWcaSignIn();
          } catch (error) {
            setError(error instanceof Error ? error.message : "WCA sign-in could not start.");
          }
        }}
        startIcon={<AccountCircle />}
      >
        Sign in
      </Button>
    );
    return configured ? (
      button
    ) : (
      <Tooltip title="Set VITE_WCA_OAUTH_CLIENT_ID to enable WCA sign-in.">
        <span>{button}</span>
      </Tooltip>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {user.isLoading ? <CircularProgress size={20} /> : null}
      <Typography
        noWrap
        sx={{ display: { xs: "none", sm: "block" }, maxWidth: 180 }}
        variant="body2"
      >
        {user.data ? user.data.name : "WCA signed in"}
      </Typography>
      <Button color="inherit" onClick={signOut}>
        Sign out
      </Button>
    </Stack>
  );
}

export function AuthNotice() {
  const error = useAuthStore((state) => state.error);
  const dismissError = useAuthStore((state) => state.dismissError);
  if (!error) return null;
  return (
    <Alert onClose={dismissError} severity="warning" sx={{ borderRadius: 0 }}>
      {error}
    </Alert>
  );
}
