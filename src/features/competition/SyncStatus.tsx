import {
  CloudDoneOutlined,
  CloudOffOutlined,
  HourglassTop,
  SaveOutlined,
} from "@mui/icons-material";
import { Chip } from "@mui/material";
import type { ReactElement } from "react";
import type { SyncLabel } from "./viewModel";

const syncIcon: Record<SyncLabel, ReactElement> = {
  Local: <SaveOutlined aria-hidden="true" />,
  Sending: <HourglassTop aria-hidden="true" />,
  "On WCA Live": <CloudDoneOutlined aria-hidden="true" />,
  Failed: <CloudOffOutlined aria-hidden="true" />,
};

const syncColor = {
  Local: "default",
  Sending: "primary",
  "On WCA Live": "success",
  Failed: "error",
} as const;

export function SyncStatus({ label }: { label: SyncLabel }) {
  return (
    <Chip
      color={syncColor[label]}
      icon={syncIcon[label]}
      label={label}
      size="small"
      variant="outlined"
    />
  );
}
