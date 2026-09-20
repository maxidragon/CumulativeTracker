import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

type ConfirmActionDialogProps = {
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmActionDialog({
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmActionDialogProps) {
  return (
    <Dialog aria-describedby="confirmation-description" onClose={onCancel} open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirmation-description">{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="warning" onClick={onConfirm} variant="contained">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
