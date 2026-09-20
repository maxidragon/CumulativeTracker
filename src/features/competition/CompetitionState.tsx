import { Alert, Box, Button, CircularProgress } from "@mui/material";
import type { PropsWithChildren, ReactNode } from "react";
import type { CompetitionData } from "./data";

type CompetitionStateProps = PropsWithChildren<{
  data: CompetitionData | undefined;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  loadingLabel?: string;
  children: ReactNode;
}>;

export function CompetitionState({
  children,
  data,
  error,
  isLoading,
  loadingLabel = "Loading competition",
  onRetry,
}: CompetitionStateProps) {
  if (isLoading) {
    return (
      <Box aria-label={loadingLabel} sx={{ display: "grid", placeItems: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!data) {
    return (
      <Alert
        action={<Button onClick={onRetry}>Retry</Button>}
        severity="error"
      >
        {error?.message ?? "The competition could not be loaded."}
      </Alert>
    );
  }
  return children;
}
