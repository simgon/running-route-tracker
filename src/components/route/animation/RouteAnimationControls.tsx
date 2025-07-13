import React from "react";
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Typography,
  Paper,
  Collapse,
  useTheme,
} from "@mui/material";
import {
  PlayArrow,
  Stop,
  Timeline,
  FlashOn,
  FiberManualRecord,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import { AnimationType, RouteAnimationConfig } from "./useRouteAnimation";

interface RouteAnimationControlsProps {
  isAnimating: boolean;
  animationType: AnimationType;
  config: RouteAnimationConfig;
  onStartAnimation: () => void;
  onStopAnimation: () => void;
  onTypeChange: (type: AnimationType) => void;
  onConfigChange: (config: Partial<RouteAnimationConfig>) => void;
  disabled?: boolean;
}

export const RouteAnimationControls: React.FC<RouteAnimationControlsProps> = ({
  isAnimating,
  animationType,
  config,
  onStartAnimation,
  onStopAnimation,
  onTypeChange,
  onConfigChange,
  disabled = false,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(false);

  const animationTypeOptions = [
    { value: "draw", label: "描画", icon: <Timeline /> },
    { value: "pulse", label: "パルス", icon: <FiberManualRecord /> },
    { value: "flash", label: "フラッシュ", icon: <FlashOn /> },
  ];

  const colorOptions = [
    { value: "#FF4444", label: "赤", color: "#FF4444" },
    { value: "#4CAF50", label: "緑", color: "#4CAF50" },
    { value: "#2196F3", label: "青", color: "#2196F3" },
    { value: "#FF9800", label: "オレンジ", color: "#FF9800" },
    { value: "#9C27B0", label: "紫", color: "#9C27B0" },
  ];

  return (
    <Paper
      elevation={2}
      sx={{
        position: "absolute",
        top: 16,
        right: 80,
        zIndex: 1000,
        p: 2,
        minWidth: 200,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: "bold", flex: 1 }}>
          ルートアニメーション
        </Typography>

        {/* 再生/停止ボタン */}
        <Tooltip title={isAnimating ? "アニメーション停止" : "アニメーション開始"}>
          <IconButton
            onClick={isAnimating ? onStopAnimation : onStartAnimation}
            disabled={disabled}
            size="small"
            sx={{
              backgroundColor: isAnimating ? theme.palette.error.main : theme.palette.primary.main,
              color: "white",
              "&:hover": {
                backgroundColor: isAnimating
                  ? theme.palette.error.dark
                  : theme.palette.primary.dark,
              },
            }}
          >
            {isAnimating ? <Stop /> : <PlayArrow />}
          </IconButton>
        </Tooltip>

        {/* 設定展開ボタン */}
        <Tooltip title={expanded ? "設定を閉じる" : "詳細設定"}>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* アニメーションタイプ選択 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          アニメーションタイプ
        </Typography>
        <ToggleButtonGroup
          value={animationType}
          exclusive
          onChange={(_, value) => value && onTypeChange(value)}
          size="small"
          fullWidth
        >
          {animationTypeOptions.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              <Tooltip title={option.label}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {option.icon}
                  <Typography variant="caption">{option.label}</Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* 詳細設定 */}
      <Collapse in={expanded}>
        <Box sx={{ space: 2 }}>
          {/* スピード設定 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              アニメーション速度: {config.speed}ms
            </Typography>
            <Slider
              value={config.speed}
              onChange={(_, value) => onConfigChange({ speed: value as number })}
              min={50}
              max={500}
              step={25}
              size="small"
              disabled={disabled}
            />
          </Box>

          {/* 線の太さ */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              線の太さ: {config.lineWidth}px
            </Typography>
            <Slider
              value={config.lineWidth}
              onChange={(_, value) => onConfigChange({ lineWidth: value as number })}
              min={2}
              max={10}
              step={1}
              size="small"
              disabled={disabled}
            />
          </Box>

          {/* 色選択 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              アニメーション色
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {colorOptions.map((colorOption) => (
                <Tooltip key={colorOption.value} title={colorOption.label}>
                  <IconButton
                    onClick={() => onConfigChange({ color: colorOption.value })}
                    size="small"
                    sx={{
                      width: 32,
                      height: 32,
                      backgroundColor: colorOption.color,
                      border:
                        config.color === colorOption.value ? "3px solid #000" : "1px solid #ccc",
                      "&:hover": {
                        backgroundColor: colorOption.color,
                        opacity: 0.8,
                      },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default RouteAnimationControls;
