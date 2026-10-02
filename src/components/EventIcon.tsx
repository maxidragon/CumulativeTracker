import { Box } from "@mui/material";

/** The WCA event icon from `@cubing/icons`, the same set WCA Live uses. */
export function EventIcon({ eventId, eventName }: { eventId: string; eventName: string }) {
  return (
    <Box
      aria-label={eventName}
      className={`cubing-icon event-${eventId}`}
      component="span"
      role="img"
      sx={{ fontSize: 20 }}
      title={eventName}
    />
  );
}
