import React, { useState } from "react";
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
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  DirectionsRun as RunIcon,
  Schedule as TimeIcon
} from '@mui/icons-material';

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
  distance: number;
  duration: number;
  isLoading?: boolean;
}

const SaveRouteModal: React.FC<SaveRouteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  distance,
  duration,
  isLoading = false,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60)
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("ルート名を入力してください");
      return;
    }

    try {
      setError("");
      await onSave(name.trim(), description.trim() || undefined);
      // 成功時はリセット
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setError("");
    onClose();
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
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RunIcon color="primary" />
        <Typography variant="h5" component="h2">
          ランニングルートを保存
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* ルート情報 */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: 'grey.50',
          }}
        >
          <Box sx={{ display: "flex", gap: 3, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RunIcon color="primary" />
              <Typography variant="body1" fontWeight="medium">
                距離: {formatDistance(distance)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimeIcon color="primary" />
              <Typography variant="body1" fontWeight="medium">
                時間: {formatDuration(duration)}
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
        <Button
          onClick={handleClose}
          disabled={isLoading}
          variant="outlined"
          color="inherit"
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading || !name.trim()}
          variant="contained"
          startIcon={
            isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
          }
          sx={{ ml: 1 }}
        >
          {isLoading ? "保存中..." : "保存"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveRouteModal;
