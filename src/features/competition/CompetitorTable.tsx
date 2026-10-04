import { CheckCircle, ErrorOutlined } from "@mui/icons-material";
import {
  Box,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Person } from "@wca/helpers";
import { Link, useNavigate } from "react-router-dom";
import { formatTime } from "../../lib/attempt";
import { attemptsForFormat, type Budget, type BudgetSummary } from "../../lib/cumulative";
import type { CompetitionRound } from "../../lib/wca";
import { EventIcon } from "../../components/EventIcon";
import { budgetSyncLabel, countryFlag, formatAttemptResult } from "./viewModel";

export type CompetitorRow = {
  person: Person;
  budget: Budget;
  summary: BudgetSummary;
};

/** Every entered attempt is on WCA Live: a tick; a failed submission: a warning. */
function LiveState({ budget }: { budget: Budget }) {
  const sync = budgetSyncLabel(budget);
  if (sync === "On WCA Live") {
    return <CheckCircle aria-label="On WCA Live" color="success" fontSize="small" />;
  }
  if (sync === "Failed") {
    return <ErrorOutlined aria-label="WCA Live submission failed" color="error" fontSize="small" />;
  }
  return null;
}

type CompetitorTableProps = {
  rows: CompetitorRow[];
  cumulative: boolean;
  rounds: CompetitionRound[];
  liveMode: boolean;
  selectedRegistrantId: number | null;
  linkTo: (registrantId: number) => string;
};

const numeric = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;
const attemptCell = { ...numeric, minWidth: 56, px: 1 } as const;

/**
 * Laid out like WCA Live's round table — one column per attempt — with the budget columns
 * this app adds. Clicking anywhere on a row opens that competitor, as in WCA Live.
 */
export function CompetitorTable({
  rows,
  cumulative,
  rounds,
  liveMode,
  selectedRegistrantId,
  linkTo,
}: CompetitorTableProps) {
  const navigate = useNavigate();
  const multiRound = rounds.length > 1;
  const columns = rounds.map((round) => ({
    round,
    attemptNumbers: Array.from(
      { length: attemptsForFormat(round.format) },
      (_, index) => index + 1,
    ),
  }));
  const used = ({ summary }: CompetitorRow) => formatTime(summary.usedCentiseconds);
  const remaining = ({ summary }: CompetitorRow) =>
    cumulative
      ? `${summary.isUpperBound ? "≤ " : ""}${formatTime(Math.max(0, summary.remainingCentiseconds))}`
      : "—";
  const budgetHeaders = (rowSpan: number) => (
    <>
      <TableCell align="right" rowSpan={rowSpan}>
        Used
      </TableCell>
      <TableCell align="right" rowSpan={rowSpan}>
        Remaining
      </TableCell>
      {liveMode ? (
        <TableCell align="center" rowSpan={rowSpan}>
          WCA Live
        </TableCell>
      ) : null}
    </>
  );

  return (
    <>
      <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
        <Table size="small">
          <TableHead sx={{ "& th": { whiteSpace: "nowrap" } }}>
            <TableRow>
              <TableCell align="right" rowSpan={multiRound ? 2 : 1}>
                #
              </TableCell>
              <TableCell rowSpan={multiRound ? 2 : 1}>Competitor</TableCell>
              {multiRound
                ? columns.map(({ round, attemptNumbers }) => (
                    <TableCell
                      align="center"
                      colSpan={attemptNumbers.length}
                      key={round.roundId}
                      sx={{ borderLeft: 1, borderColor: "divider" }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", justifyContent: "center" }}
                      >
                        <EventIcon eventId={round.eventId} eventName={round.eventName} />
                        <span aria-hidden="true">{round.eventId}</span>
                      </Stack>
                    </TableCell>
                  ))
                : columns[0]?.attemptNumbers.map((number) => (
                    <TableCell align="right" key={number} sx={{ px: 1 }}>
                      {number}
                    </TableCell>
                  ))}
              {budgetHeaders(multiRound ? 2 : 1)}
            </TableRow>
            {multiRound ? (
              <TableRow>
                {columns.flatMap(({ round, attemptNumbers }) =>
                  attemptNumbers.map((number) => (
                    <TableCell
                      align="right"
                      key={`${round.roundId}:${number}`}
                      sx={{
                        px: 1,
                        ...(number === 1 ? { borderLeft: 1, borderColor: "divider" } : {}),
                      }}
                    >
                      {number}
                    </TableCell>
                  )),
                )}
              </TableRow>
            ) : null}
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const { person, budget } = row;
              return (
                <TableRow
                  hover
                  key={person.registrantId}
                  onClick={() => void navigate(linkTo(person.registrantId))}
                  selected={person.registrantId === selectedRegistrantId}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell align="right" sx={numeric}>
                    {person.registrantId}
                  </TableCell>
                  <TableCell>
                    <MuiLink
                      component={Link}
                      onClick={(event) => event.stopPropagation()}
                      sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                      to={linkTo(person.registrantId)}
                      underline="hover"
                    >
                      {countryFlag(person.countryIso2)} {person.name}
                    </MuiLink>
                  </TableCell>
                  {columns.flatMap(({ round, attemptNumbers }) =>
                    attemptNumbers.map((number) => {
                      const attempt = budget.attempts.find(
                        (candidate) =>
                          candidate.roundId === round.roundId &&
                          candidate.attemptNumber === number,
                      );
                      return (
                        <TableCell
                          align="right"
                          key={`${round.roundId}:${number}`}
                          sx={{
                            ...attemptCell,
                            ...(multiRound && number === 1
                              ? { borderLeft: 1, borderColor: "divider" }
                              : {}),
                          }}
                        >
                          {attempt ? formatAttemptResult(attempt) : ""}
                        </TableCell>
                      );
                    }),
                  )}
                  <TableCell align="right" sx={numeric}>
                    {used(row)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...numeric, fontWeight: 700 }}>
                    {remaining(row)}
                  </TableCell>
                  {liveMode ? (
                    <TableCell align="center" sx={{ lineHeight: 0 }}>
                      <LiveState budget={budget} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        component="ul"
        spacing={1}
        sx={{ display: { xs: "flex", md: "none" }, listStyle: "none", m: 0, p: 0 }}
      >
        {rows.map((row) => {
          const { person, budget } = row;
          return (
            <Box
              component="li"
              key={person.registrantId}
              sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}
            >
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0 }}>
                  <MuiLink
                    component={Link}
                    sx={{ fontWeight: 700 }}
                    to={linkTo(person.registrantId)}
                    underline="hover"
                  >
                    {countryFlag(person.countryIso2)} {person.name}
                  </MuiLink>
                  <Typography color="text.secondary" variant="body2">
                    #{person.registrantId} · used {used(row)} · remaining {remaining(row)}
                  </Typography>
                </Box>
                {liveMode ? <LiveState budget={budget} /> : null}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </>
  );
}
