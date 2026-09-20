import { ErrorOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { downloadSafeDataExport } from "../lib/storage";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error("Route render failed", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box sx={{ maxWidth: 680, py: 4 }}>
        <Stack spacing={3}>
          <Alert icon={<ErrorOutlined />} severity="error">
            This screen could not be rendered. Your locally tracked data is still stored in
            this browser.
          </Alert>
          <Typography component="h1" variant="h3">
            Something went wrong
          </Typography>
          <Typography color="text.secondary">
            Export a recovery copy before reloading if you entered results during this
            session. Tokens are excluded from the export.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button onClick={downloadSafeDataExport} variant="outlined">
              Export my data
            </Button>
            <Button onClick={() => window.location.reload()} variant="contained">
              Reload
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }
}
