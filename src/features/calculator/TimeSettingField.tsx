import { TextField } from "@mui/material";
import { useState } from "react";
import { formatTime, parseTimeInput } from "../../lib/attempt";

type TimeSettingFieldProps = {
  label: string;
  onCommit: (value: number | null) => void;
  optional?: boolean;
  value: number | null;
};

export function TimeSettingField({
  label,
  onCommit,
  optional = false,
  value,
}: TimeSettingFieldProps) {
  const formattedValue = value === null ? "" : formatTime(value, { compact: true });
  const [draft, setDraft] = useState(formattedValue);
  const [previousValue, setPreviousValue] = useState(value);
  const [error, setError] = useState(false);

  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(formattedValue);
    setError(false);
  }

  const commit = () => {
    if (optional && draft.trim() === "") {
      setError(false);
      if (value !== null) onCommit(null);
      return;
    }
    const normalized = draft.includes(":") && !draft.includes(".") ? `${draft}.00` : draft;
    const parsed = parseTimeInput(normalized);
    if (parsed === null || parsed <= 0) {
      setError(true);
      setDraft(formattedValue);
      return;
    }
    setError(false);
    setDraft(formatTime(parsed, { compact: true }));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <TextField
      error={error}
      fullWidth
      helperText={error ? "Enter a time such as 20:00." : optional ? "Optional" : undefined}
      label={label}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          setDraft(formattedValue);
          setError(false);
        }
      }}
      placeholder={optional ? "No separate limit" : undefined}
      slotProps={{ htmlInput: { inputMode: "numeric" } }}
      value={draft}
    />
  );
}
