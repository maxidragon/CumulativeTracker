import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { AuthControls, AuthNotice } from "../features/auth/AuthControls";

export function AppShell() {
  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <AppBar color="transparent" elevation={0} position="static">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 72 }}>
            <Typography
              color="text.primary"
              component={Link}
              sx={{ fontWeight: 800, textDecoration: "none" }}
              to="/"
              variant="h6"
            >
              Cumulative Tracker
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <AuthControls />
            <Button color="inherit" component={Link} to="/settings">
              Settings
            </Button>
          </Toolbar>
        </Container>
      </AppBar>
      <AuthNotice />
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 5, md: 9 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
