import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger" | "info";
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "確認",
  cancelText = "キャンセル",
  variant = "warning",
}) => {
  const getVariantColor = () => {
    switch (variant) {
      case "danger":
        return "error";
      case "info":
        return "info";
      default:
        return "warning";
    }
  };

  const getVariantIcon = () => {
    return <WarningIcon color={getVariantColor()} />;
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        {getVariantIcon()}
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onCancel} variant="outlined" color="inherit">
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={getVariantColor()}
          autoFocus
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;