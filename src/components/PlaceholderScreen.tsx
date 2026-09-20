import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router-dom";

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
}: PlaceholderScreenProps) {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Typography color="primary" sx={{ fontWeight: 800 }} variant="overline">
        {eyebrow}
      </Typography>
      <Typography component="h1" sx={{ mt: 1 }} variant="h2">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 20, my: 3 }}>
        {description}
      </Typography>
      <Button component={Link} to="/" variant="outlined">
        Back home
      </Button>
    </Box>
  );
}
