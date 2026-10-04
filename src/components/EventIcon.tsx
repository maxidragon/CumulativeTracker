import { Box } from "@mui/material";

/** The WCA event icon from `@cubing/icons`, the same set WCA Live uses. */
export function EventIcon({
  eventId,
  eventName,
  size = 20,
}: {
  eventId: string;
  eventName: string;
  size?: number;
}) {
  return (
    <Box
      aria-label={eventName}
      className={`cubing-icon event-${eventId}`}
      component="span"
      role="img"
      sx={{ flexShrink: 0, fontSize: size }}
      title={eventName}
    />
  );
}
