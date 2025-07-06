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
import { RunningRoute } from "../lib/supabase";

interface EditRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    routeId: string,
    updates: { name?: string; description?: string; duration?: number }
  ) => Promise<void>;
  route: RunningRoute | null;
  isLoading?: boolean;
}

const EditRouteModal: React.FC<EditRouteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  route,
  isLoading = false,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [useManualDuration, setUseManualDuration] = useState(false);
  const [error, setError] = useState("");

  // ルート情報をフォームに設定
  useEffect(() => {
    if (route) {
      setName(route.name);
      setDescription(route.description || "");

      // 既存の時間を時分秒に分解
      if (route.duration && route.duration > 0) {
        // route.durationは秒数で保存されている
        const totalSeconds = route.duration;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        console.log(
          `Debug: route.duration=${route.duration}, totalSeconds=${totalSeconds}, h=${h}, m=${m}, s=${s}`
        );

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
    }
  }, [route]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!route) return;

    if (!name.trim()) {
      setError("ルート名を入力してください");
      return;
    }

    try {
      setError("");
      const updates: { name?: string; description?: string; duration?: number } = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      if (useManualDuration) {
        updates.duration = getManualDurationSeconds();
      }

      await onSave(route.id, updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    }
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  if (!route) return null;

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
        <Typography variant="h5" component="span">
          ルート編集
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
                距離: {formatDistance(route.distance)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TimeIcon color="primary" />
              <Typography variant="body1" fontWeight="medium">
                時間:{" "}
                {useManualDuration ? getManualDurationText() : formatDuration(route.duration || 0)}
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
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              現在の時間を編集できます
            </Typography>
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

export default EditRouteModal;
