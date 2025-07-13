import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  SaveAlt,
  Cancel,
  Undo,
  AddCircleOutline,
  Polyline,
  RemoveCircleOutline,
  ChangeCircle,
} from "@mui/icons-material";

export type EditingMode = "add" | "addOnRoute" | "delete" | "roundTrip";

interface RouteCreationControlsProps {
  isCreationMode: boolean;
  isEditMode: boolean;
  editingMode: EditingMode;
  undoStack: any[];
  onSave: () => void;
  onModeToggle: () => void;
  onCrosshairAction: () => void;
  onUndoOrRemoveLastPin: () => void;
  onCancel: () => void;
}

const RouteCreationControls: React.FC<RouteCreationControlsProps> = ({
  isCreationMode,
  isEditMode,
  editingMode,
  undoStack,
  onSave,
  onModeToggle,
  onCrosshairAction,
  onUndoOrRemoveLastPin,
  onCancel,
}) => {
  if (!isCreationMode && !isEditMode) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1001,
        backgroundColor: "rgba(255, 255, 255, 0.4)",
        borderRadius: 4,
        pb: 1,
        px: 1.5,
        boxShadow: 4,
        backdropFilter: "blur(12px)",
        display: "flex",
        gap: 1.8,
        alignItems: "flex-end",
        height: 70,
        overflow: "visible",
      }}
    >
      {/* 1. 保存ボタン */}
      <Tooltip title={isEditMode ? "適用" : "保存"}>
        <IconButton
          onClick={onSave}
          sx={{
            backgroundColor: "rgba(33, 150, 243, 0.8)",
            color: "white",
            width: 56,
            height: 56,
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "rgba(33, 150, 243, 1)",
            },
          }}
        >
          <SaveAlt fontSize="large" />
        </IconButton>
      </Tooltip>

      {/* 2. モード切り替えボタン */}
      <Tooltip title="編集モード切り替え">
        <IconButton
          onClick={onModeToggle}
          sx={{
            backgroundColor: "rgba(76, 175, 80, 0.8)",
            color: "white",
            width: 56,
            height: 56,
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "rgba(76, 175, 80, 1)",
            },
          }}
        >
          <ChangeCircle fontSize="large" />
        </IconButton>
      </Tooltip>

      {/* 3. メインアクションボタン（編集モードに応じて変化） */}
      {editingMode === "add" && (
        <Tooltip title="ピン追加">
          <IconButton
            onClick={onCrosshairAction}
            sx={{
              backgroundColor: "rgba(76, 175, 80, 0.9)",
              color: "white",
              width: 80,
              height: 80,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "rgba(76, 175, 80, 1)",
              },
            }}
          >
            <AddCircleOutline sx={{ fontSize: "3rem" }} />
          </IconButton>
        </Tooltip>
      )}

      {editingMode === "addOnRoute" && (
        <Tooltip title="ルート上にピン追加">
          <IconButton
            onClick={onCrosshairAction}
            sx={{
              backgroundColor: "rgba(76, 175, 80, 0.9)",
              color: "white",
              width: 80,
              height: 80,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "rgba(76, 175, 80, 1)",
              },
            }}
          >
            <Polyline sx={{ fontSize: "3rem" }} />
          </IconButton>
        </Tooltip>
      )}

      {editingMode === "delete" && (
        <Tooltip title="ピン削除">
          <IconButton
            onClick={onCrosshairAction}
            sx={{
              backgroundColor: "rgba(76, 175, 80, 0.9)",
              color: "white",
              width: 80,
              height: 80,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "rgba(76, 175, 80, 1)",
              },
            }}
          >
            <RemoveCircleOutline sx={{ fontSize: "3rem" }} />
          </IconButton>
        </Tooltip>
      )}

      {editingMode === "roundTrip" && (
        <Tooltip title="往復ルート追加">
          <IconButton
            onClick={onCrosshairAction}
            sx={{
              backgroundColor: "rgba(156, 39, 176, 0.9)",
              color: "white",
              width: 80,
              height: 80,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "rgba(156, 39, 176, 1)",
              },
            }}
          >
            <Polyline sx={{ fontSize: "3rem" }} />
          </IconButton>
        </Tooltip>
      )}

      {/* 4. Undo/末尾削除ボタン */}
      <Tooltip title={undoStack.length > 0 ? "元に戻す" : "末尾ピン削除"}>
        <IconButton
          onClick={onUndoOrRemoveLastPin}
          sx={{
            backgroundColor: "rgba(255, 152, 0, 0.8)",
            color: "white",
            width: 56,
            height: 56,
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "rgba(255, 152, 0, 1)",
            },
          }}
        >
          <Undo fontSize="large" />
        </IconButton>
      </Tooltip>

      {/* 5. キャンセルボタン */}
      <Tooltip title="キャンセル">
        <IconButton
          onClick={onCancel}
          sx={{
            backgroundColor: "rgba(244, 67, 54, 0.8)",
            color: "white",
            width: 56,
            height: 56,
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "rgba(244, 67, 54, 1)",
            },
          }}
        >
          <Cancel fontSize="large" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default RouteCreationControls;