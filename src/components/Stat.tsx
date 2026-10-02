import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

type StatProps = {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  emphasis?: boolean;
};

/** One labelled figure in tabular digits, so it does not reflow as the digits change. */
export function Stat({ label, value, caption, emphasis = false }: StatProps) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" variant="overline">
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          lineHeight: 1.1,
          fontSize: emphasis ? { xs: 40, md: 48 } : { xs: 28, md: 32 },
          color: emphasis ? "primary.main" : "text.primary",
        }}
      >
        {value}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {caption}
      </Typography>
    </Box>
  );
}
