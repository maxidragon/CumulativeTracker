import { AccountCircle } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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

  const name = user.data?.name ?? "WCA account";
  return (
    <>
      <IconButton
        aria-controls={menuAnchor ? "account-menu" : undefined}
        aria-expanded={menuAnchor ? "true" : undefined}
        aria-haspopup="true"
        aria-label={`Account: ${name}`}
        onClick={(event) => setMenuAnchor(event.currentTarget)}
      >
        {user.isLoading ? (
          <CircularProgress size={32} />
        ) : (
          <Avatar alt={name} src={user.data?.avatarUrl ?? undefined} sx={{ height: 32, width: 32 }}>
            {name.charAt(0)}
          </Avatar>
        )}
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        id="account-menu"
        onClose={() => setMenuAnchor(null)}
        open={menuAnchor !== null}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <Typography noWrap sx={{ maxWidth: 240, px: 2, py: 1 }} variant="subtitle2">
          {name}
        </Typography>
        <Divider />
        <MenuItem component={Link} onClick={() => setMenuAnchor(null)} to="/settings">
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            signOut();
          }}
        >
          Sign out
        </MenuItem>
      </Menu>
    </>
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
