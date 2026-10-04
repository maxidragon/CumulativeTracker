import { Calculate } from "@mui/icons-material";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { AuthControls, AuthNotice } from "../features/auth/AuthControls";
import { useAuthStore } from "../features/auth/store";

export function AppShell() {
  const session = useAuthStore((state) => state.session);
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
              sx={{
                alignItems: "center",
                display: "flex",
                fontWeight: 800,
                gap: 1,
                textDecoration: "none",
              }}
              to="/"
              variant="h6"
            >
              <Box
                alt=""
                component="img"
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                sx={{ display: "block", height: 28, width: 28 }}
              />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Cumulative Tracker
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                Tracker
              </Box>
            </Typography>
            <Button
              color="inherit"
              component={Link}
              startIcon={<Calculate />}
              sx={{ ml: { xs: 1, sm: 3 } }}
              to="/calculator"
            >
              Calculator
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {session ? null : (
              <Button color="inherit" component={Link} to="/settings">
                Settings
              </Button>
            )}
            <AuthControls />
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
