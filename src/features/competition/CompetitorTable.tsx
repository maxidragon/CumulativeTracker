import {
  CheckCircleOutlined,
  ErrorOutlined,
  HelpOutlined,
  RadioButtonUnchecked,
  WarningAmber,
} from "@mui/icons-material";
import {
  Box,
  Chip,
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
import { useEffect, useRef, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatTime } from "../../lib/attempt";
import { attemptsForFormat, type Budget, type BudgetSummary } from "../../lib/cumulative";
import type { CompetitionRound } from "../../lib/wca";
import { EventIcon } from "../../components/EventIcon";
import { SyncStatus } from "./SyncStatus";
import {
  budgetSyncLabel,
  countryFlag,
  formatAttemptResult,
  type CompetitorStatus,
} from "./viewModel";

export type CompetitorRow = {
  person: Person;
  budget: Budget;
  summary: BudgetSummary;
  status: CompetitorStatus;
};

const statusColor = {
  "Not started": "default",
  "On track": "success",
  Tight: "warning",
  Exhausted: "error",
  Incomplete: "warning",
} as const;

const statusIcon: Record<CompetitorStatus, ReactElement> = {
  "Not started": <RadioButtonUnchecked aria-hidden="true" />,
  "On track": <CheckCircleOutlined aria-hidden="true" />,
  Tight: <WarningAmber aria-hidden="true" />,
  Exhausted: <ErrorOutlined aria-hidden="true" />,
  Incomplete: <HelpOutlined aria-hidden="true" />,
};

function StatusChip({ status }: { status: CompetitorStatus }) {
  return (
    <Chip
      color={statusColor[status]}
      icon={statusIcon[status]}
      label={status}
      size="small"
      variant="outlined"
    />
  );
}

type CompetitorTableProps = {
  rows: CompetitorRow[];
  cumulative: boolean;
  rounds: CompetitionRound[];
  liveMode: boolean;
  selectedRegistrantId: number | null;
  /** Picked with ↑/↓ in the search, not opened yet. */
  highlightedRegistrantId: number | null;
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
  highlightedRegistrantId,
  linkTo,
}: CompetitorTableProps) {
  const navigate = useNavigate();
  const highlightedRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedRegistrantId]);
  const multiRound = rounds.length > 1;
  const columns = rounds.map((round) => ({
    round,
    attemptNumbers: Array.from(
      { length: attemptsForFormat(round.format) },
      (_, index) => index + 1,
    ),
  }));
  const remaining = ({ summary }: CompetitorRow) =>
    cumulative
      ? `${summary.isUpperBound ? "≤ " : ""}${formatTime(Math.max(0, summary.remainingCentiseconds), { compact: true })}`
      : "—";
  const nextCap = ({ summary }: CompetitorRow) =>
    formatTime(Math.max(0, summary.capForNextAttemptCentiseconds), { compact: true });
  const budgetHeaders = (rowSpan: number) => (
    <>
      <TableCell align="right" rowSpan={rowSpan}>
        Remaining
      </TableCell>
      <TableCell align="right" rowSpan={rowSpan}>
        Next cap
      </TableCell>
      <TableCell rowSpan={rowSpan}>Status</TableCell>
      {liveMode ? <TableCell rowSpan={rowSpan}>Sync</TableCell> : null}
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
              const { person, budget, status } = row;
              const sync = budgetSyncLabel(budget);
              const highlighted = person.registrantId === highlightedRegistrantId;
              return (
                <TableRow
                  aria-current={highlighted ? "true" : undefined}
                  hover
                  key={person.registrantId}
                  onClick={() => void navigate(linkTo(person.registrantId))}
                  ref={highlighted ? highlightedRef : undefined}
                  selected={person.registrantId === selectedRegistrantId}
                  sx={{
                    cursor: "pointer",
                    ...(highlighted
                      ? { outline: 2, outlineColor: "primary.main", outlineOffset: -2 }
                      : {}),
                  }}
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
                    {remaining(row)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...numeric, fontWeight: 700 }}>
                    {nextCap(row)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={status} />
                  </TableCell>
                  {liveMode ? (
                    <TableCell>{sync ? <SyncStatus label={sync} /> : "—"}</TableCell>
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
          const { person, budget, status } = row;
          const sync = budgetSyncLabel(budget);
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
                    #{person.registrantId} · remaining {remaining(row)} · cap {nextCap(row)}
                  </Typography>
                </Box>
                <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
                  <StatusChip status={status} />
                  {liveMode && sync ? <SyncStatus label={sync} /> : null}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </>
  );
}
