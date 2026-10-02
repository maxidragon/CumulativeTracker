import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { AuthControls, AuthNotice } from "../features/auth/AuthControls";

export function AppShell() {
  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <AppBar
        color="transparent"
        elevation={0}
        position="static"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{ flexWrap: { xs: "wrap", sm: "nowrap" }, minHeight: 56, py: 0.5 }}
          >
            <Typography
              color="text.primary"
              component={Link}
              sx={{ fontWeight: 800, textDecoration: "none" }}
              to="/"
              variant="h6"
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Cumulative Tracker
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                Tracker
              </Box>
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
      <Container component="main" maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
