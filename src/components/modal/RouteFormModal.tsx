import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Paper,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  Save as SaveIcon,
  DirectionsRun as RunIcon,
  Schedule as TimeIcon,
  Timeline,
} from "@mui/icons-material";
import { RunningRoute } from "../../lib/supabase";

interface RouteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 新規保存用
  onSave?: (name: string, description?: string, customDuration?: number) => Promise<void>;
  distance?: number;
  duration?: number;
  // 編集用
  onUpdate?: (
    routeId: string,
    updates: { name?: string; description?: string; duration?: number }
  ) => Promise<void>;
  route?: RunningRoute | null;
  isLoading?: boolean;
  mode: "save" | "edit";
}

const RouteFormModal: React.FC<RouteFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  distance = 0,
  duration = 0,
  onUpdate,
  route,
  isLoading = false,
  mode,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [useManualDuration, setUseManualDuration] = useState(false);

  // 編集モード時のルート情報をフォームに設定
  useEffect(() => {
    if (mode === "edit" && route) {
      setName(route.name);
      setDescription(route.description || "");

      // 既存の時間を時分秒に分解
      if (route.duration && route.duration > 0) {
        const totalSeconds = route.duration;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        setHours(h.toString());
        setMinutes(m.toString());
        setSeconds(s.toString());
        setUseManualDuration(true);
      } else {
        setHours("0");
        setMinutes("0");
        setSeconds("0");
        setUseManualDuration(false);
      }
    } else if (mode === "save") {
      // 新規作成モード時はリセット
      setName("");
      setDescription("");
      setHours("");
      setMinutes("");
      setSeconds("");
      setUseManualDuration(false);
    }
  }, [mode, route]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (inputDuration: number) => {
    let seconds: number;
    if (mode === "save") {
      // 新規保存時はミリ秒
      seconds = Math.floor(inputDuration / 1000);
    } else {
      // 編集時は秒数
      seconds = inputDuration;
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("ルート名を入力してください");
      return;
    }

    try {
      setError("");

      if (mode === "save" && onSave) {
        const customDuration = useManualDuration ? getManualDurationSeconds() : undefined;
        await onSave(name.trim(), description.trim() || undefined, customDuration);
        // 成功時はリセット
        setName("");
        setDescription("");
        setHours("");
        setMinutes("");
        setSeconds("");
        setUseManualDuration(false);
      } else if (mode === "edit" && onUpdate && route) {
        const updates: { name?: string; description?: string; duration?: number } = {
          name: name.trim(),
          description: description.trim() || undefined,
        };

        if (useManualDuration) {
          updates.duration = getManualDurationSeconds();
        }

        await onUpdate(route.id, updates);
      }

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "save"
          ? "保存に失敗しました"
          : "更新に失敗しました"
      );
    }
  };

  const getManualDurationSeconds = (): number => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const s = parseInt(seconds, 10) || 0;
    return h * 3600 + m * 60 + s;
  };

  const getManualDurationText = (): string => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const s = parseInt(seconds, 10) || 0;

    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleClose = () => {
    if (mode === "save") {
      setName("");
      setDescription("");
      setHours("");
      setMinutes("");
      setSeconds("");
      setUseManualDuration(false);
    }
    setError("");
    onClose();
  };

  const getDisplayDistance = () => {
    if (mode === "edit" && route) {
      return route.distance;
    }
    return distance;
  };

  const getDisplayDuration = () => {
    if (mode === "edit" && route) {
      return route.duration || 0;
    }
    return duration;
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
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
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <RunIcon color="primary" />
        <Typography variant="h5" component="h2">
          {mode === "save" ? "ルート保存" : "ルート編集"}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* ルート情報 */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: "grey.50",
          }}
        >
          <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Timeline color="primary" />
              <Typography variant="body1" fontWeight="medium">
                距離: {formatDistance(getDisplayDistance())}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TimeIcon color="primary" />
              <Typography variant="body1" fontWeight="medium">
                時間:{" "}
                {useManualDuration ? getManualDurationText() : formatDuration(getDisplayDuration())}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="ルート名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 朝の公園ランニング"
            fullWidth
            required
            disabled={isLoading}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            sx={{ mb: 2 }}
            variant="outlined"
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              時間 (任意)
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                label="時"
                value={hours}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  setHours(value);
                  setUseManualDuration(
                    value.length > 0 || minutes.length > 0 || seconds.length > 0
                  );
                }}
                disabled={isLoading}
                sx={{ width: 70 }}
                variant="outlined"
                size="small"
                slotProps={{ htmlInput: { maxLength: 2 } }}
              />
              <Typography variant="body1">:</Typography>
              <TextField
                label="分"
                value={minutes}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  if (parseInt(value, 10) <= 59 || value === "") {
                    setMinutes(value);
                    setUseManualDuration(
                      hours.length > 0 || value.length > 0 || seconds.length > 0
                    );
                  }
                }}
                disabled={isLoading}
                sx={{ width: 70 }}
                variant="outlined"
                size="small"
                slotProps={{ htmlInput: { maxLength: 2 } }}
              />
              <Typography variant="body1">:</Typography>
              <TextField
                label="秒"
                value={seconds}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  if (parseInt(value, 10) <= 59 || value === "") {
                    setSeconds(value);
                    setUseManualDuration(
                      hours.length > 0 || minutes.length > 0 || value.length > 0
                    );
                  }
                }}
                disabled={isLoading}
                sx={{ width: 70 }}
                variant="outlined"
                size="small"
                slotProps={{ htmlInput: { maxLength: 2 } }}
              />
            </Box>
            {mode === "edit" && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: "block" }}
              >
                現在の時間を編集できます
              </Typography>
            )}
          </Box>

          <TextField
            label="説明 (任意)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ルートの特徴や感想を記録..."
            fullWidth
            multiline
            rows={3}
            disabled={isLoading}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            sx={{ mb: 2 }}
            variant="outlined"
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={isLoading} variant="outlined" color="inherit">
          キャンセル
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading || !name.trim()}
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ ml: 1 }}
        >
          {isLoading ? "保存中..." : "保存"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RouteFormModal;
