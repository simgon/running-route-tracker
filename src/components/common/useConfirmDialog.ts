import { useState, useCallback } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger" | "info";
}

interface ConfirmDialogState extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    message: "",
    confirmText: "確認",
    cancelText: "キャンセル",
    variant: "warning",
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showConfirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({
          ...options,
          open: true,
          onConfirm: () => {
            setDialogState((prev) => ({ ...prev, open: false }));
            resolve(true);
          },
          onCancel: () => {
            setDialogState((prev) => ({ ...prev, open: false }));
            resolve(false);
          },
        });
      });
    },
    []
  );

  const hideConfirm = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    dialogState,
    showConfirm,
    hideConfirm,
  };
};