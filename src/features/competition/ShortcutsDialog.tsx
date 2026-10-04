import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";

/** Each shortcut lists alternative chords; a chord's keys are pressed together. */
type Shortcut = [chords: string[][], action: string];

const sections: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Anywhere",
    shortcuts: [
      [[["/"]], "Find a competitor"],
      [[["?"]], "Show these shortcuts"],
    ],
  },
  {
    title: "Competitor search",
    shortcuts: [
      [[["↑"], ["↓"]], "Pick a row in the table"],
      [[["Enter"]], "Open the picked row, an exact registrant id, or the first match"],
      [[["Esc"]], "Clear the search"],
    ],
  },
  {
    title: "Attempt field",
    shortcuts: [
      [[["0–9"]], "Type the time from the right: 25000 is 2:50.00"],
      [[["Enter"]], "Save and go to the next attempt; after the last, confirm the scorecard"],
      [[["Shift", "Enter"]], "Save and go to the previous attempt"],
      [[["↑"], ["↓"]], "Save and go to the previous or next attempt"],
      [[["Tab"]], "Next attempt, skipping the DNF and DNS buttons"],
      [[["D"]], "Toggle DNF (also / or #)"],
      [[["S"]], "Toggle DNS (also *)"],
      [[["Alt", "↑"]], "Move the attempt earlier (groups with several events)"],
      [[["Alt", "↓"]], "Move the attempt later (groups with several events)"],
      [[["Esc"]], "Undo unsaved typing; if there is none, back to the search"],
    ],
  },
];

const kbd = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  fontFamily: "inherit",
  fontSize: 13,
  px: 0.75,
  py: 0.25,
} as const;

function Chords({ chords }: { chords: string[][] }) {
  return (
    <Box component="span" sx={{ whiteSpace: "nowrap" }}>
      {chords.map((chord, chordIndex) => (
        <span key={chord.join("+")}>
          {chordIndex > 0 ? " / " : null}
          {chord.map((key, keyIndex) => (
            <span key={key}>
              {keyIndex > 0 ? " + " : null}
              <Box component="kbd" sx={kbd}>
                {key}
              </Box>
            </span>
          ))}
        </span>
      ))}
    </Box>
  );
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Keyboard shortcuts</DialogTitle>
      <DialogContent>
        {sections.map(({ title, shortcuts }) => (
          <Box key={title} sx={{ mb: 2 }}>
            <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
              {title}
            </Typography>
            <Table size="small">
              <TableBody>
                {shortcuts.map(([chords, action]) => (
                  <TableRow key={action}>
                    <TableCell sx={{ pl: 0, width: 140 }}>
                      <Chords chords={chords} />
                    </TableCell>
                    <TableCell>{action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
