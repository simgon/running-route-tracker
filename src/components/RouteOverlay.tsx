import React, { useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material';
import {
  FolderOpen as FolderIcon,
  Visibility as ViewAllIcon,
  VisibilityOff,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  Create as CreateIcon
} from '@mui/icons-material';
import { RunningRoute } from "../lib/supabase";

interface RouteOverlayProps {
  routes: RunningRoute[];
  selectedRouteId?: string;
  onSelectRoute: (route: RunningRoute) => void;
  onEditRoute: (route: RunningRoute) => void;
  onDeleteRoute: (routeId: string, routeName: string) => void;
  onToggleAllRoutes?: (routes: RunningRoute[]) => void;
  showAllRoutes?: boolean;
  onStartManualCreation?: () => void;
  onStartAIGeneration?: () => void;
  onStartRouteCopy?: (route: RunningRoute) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onEditRoute,
  onDeleteRoute,
  onToggleAllRoutes,
  showAllRoutes = false,
  onStartManualCreation,
  onStartAIGeneration,
  onStartRouteCopy,
}) => {
  const isMobile = window.innerWidth <= 768;
  const [isDragging, setIsDragging] = React.useState(false);
  const [isCopyMode, setIsCopyMode] = React.useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const routeRefsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60)
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  // 選択されたルートにスクロール
  useEffect(() => {
    if (selectedRouteId && scrollContainerRef.current && routeRefsRef.current[selectedRouteId]) {
      const container = scrollContainerRef.current;
      const selectedElement = routeRefsRef.current[selectedRouteId];
      
      if (selectedElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();
        
        // 要素が表示範囲外の場合にスクロール
        const isVisible = elementRect.left >= containerRect.left && 
                         elementRect.right <= containerRect.right;
        
        if (!isVisible) {
          const scrollLeft = selectedElement.offsetLeft - container.offsetLeft - 
                           (container.clientWidth / 2) + (selectedElement.clientWidth / 2);
          
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [selectedRouteId]);

  // ルートが0件でも新規作成ボタンを表示するため、常に表示

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 3,
        p: 2,
        boxShadow: 4,
        backdropFilter: "blur(10px)",
        maxHeight: 200,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="body1" fontWeight="bold" color="text.primary">
            保存済みルート ({routes.length}個)
          </Typography>
        </Box>

        {routes.length > 1 && onToggleAllRoutes && (
          <Button
            variant={showAllRoutes ? "contained" : "outlined"}
            color={showAllRoutes ? "error" : "success"}
            size="small"
            startIcon={showAllRoutes ? <VisibilityOff /> : <ViewAllIcon />}
            onClick={() => onToggleAllRoutes(routes)}
            sx={{
              textTransform: "none",
              fontWeight: "bold",
              fontSize: "0.75rem",
            }}
          >
            {showAllRoutes ? "個別表示" : "全表示"}
          </Button>
        )}
      </Box>

      <Box
        ref={scrollContainerRef}
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          scrollbarWidth: "none", // Firefox
          msOverflowStyle: "none", // IE/Edge
          cursor: "grab",
        }}
        className="route-scroll-container"
        onMouseDown={(e) => {
          const container = e.currentTarget;
          const startX = e.pageX - container.offsetLeft;
          const scrollLeft = container.scrollLeft;
          
          container.style.cursor = "grabbing";
          
          const handleMouseMove = (e: MouseEvent) => {
            setIsDragging(true);
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2; // スクロール速度調整
            container.scrollLeft = scrollLeft - walk;
          };
          
          const handleMouseUp = () => {
            container.style.cursor = "grab";
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            
            // ドラッグ状態を少し遅延してリセット（クリックイベント抑制のため）
            setTimeout(() => {
              setIsDragging(false);
            }, 100);
          };
          
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      >
        {/* 新規ルート作成/コピーボタン */}
        {onStartManualCreation && (
          <div
            style={{
              minWidth: isMobile ? "150px" : "200px",
              maxWidth: isMobile ? "180px" : "250px",
              backgroundColor: isCopyMode ? "#fff3e0" : "#e8f5e8",
              border: isCopyMode ? "2px dashed #ff9800" : "2px dashed #28a745",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: isCopyMode ? "#ff9800" : "#28a745",
              fontWeight: "bold",
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
              position: "relative",
            }}
          >
            {/* 切り替えボタン */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isDragging) return;
                setIsCopyMode(!isCopyMode);
              }}
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "1px solid",
                borderColor: isCopyMode ? "#ff9800" : "#28a745",
                backgroundColor: "white",
                color: isCopyMode ? "#ff9800" : "#28a745",
                cursor: "pointer",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              title={isCopyMode ? "手動作成モードに切り替え" : "コピーモードに切り替え"}
            >
              {isCopyMode ? "✏️" : "📋"}
            </button>

            {/* メインボタンエリア */}
            <div
              onClick={(e) => {
                if (isDragging) {
                  e.preventDefault();
                  return;
                }
                if (isCopyMode) {
                  // コピーモード時は説明文を表示
                  alert("コピーしたいルートをクリックしてください");
                } else {
                  onStartManualCreation();
                }
              }}
              style={{ width: "100%", height: "100%" }}
              onMouseEnter={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.backgroundColor = isCopyMode ? "#ffe0b2" : "#d4edda";
                  parent.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.backgroundColor = isCopyMode ? "#fff3e0" : "#e8f5e8";
                  parent.style.transform = "translateY(0)";
                }
              }}
            >
              <div style={{ fontSize: isMobile ? "20px" : "24px", marginBottom: "8px" }}>
                {isCopyMode ? "📋" : "✏️"}
              </div>
              <div style={{ fontSize: isMobile ? "11px" : "13px", lineHeight: "1.2" }}>
                {isCopyMode ? "ルートコピー\n(ルートを選択)" : "新規ルート作成"}
              </div>
            </div>
          </div>
        )}

        {/* AIルート生成ボタン */}
        {onStartAIGeneration && (
          <div
            onClick={(e) => {
              if (isDragging) {
                e.preventDefault();
                return;
              }
              onStartAIGeneration();
            }}
            style={{
              minWidth: isMobile ? "150px" : "200px",
              maxWidth: isMobile ? "180px" : "250px",
              backgroundColor: "#e3f2fd",
              border: "2px dashed #2196f3",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "#2196f3",
              fontWeight: "bold",
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#bbdefb";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#e3f2fd";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ fontSize: isMobile ? "20px" : "24px", marginBottom: "8px" }}>🤖</div>
            <div style={{ fontSize: isMobile ? "12px" : "14px" }}>AIルート生成</div>
          </div>
        )}

        {routes.map((route) => {
          const isSelected = selectedRouteId === route.id;

          return (
            <Card
              key={route.id}
              ref={(el) => {
                routeRefsRef.current[route.id] = el;
              }}
              onClick={(e) => {
                if (isDragging) {
                  e.preventDefault();
                  return;
                }
                
                if (isCopyMode) {
                  // コピーモード：ルートをコピーして新規作成
                  if (onStartRouteCopy) {
                    onStartRouteCopy(route);
                    setIsCopyMode(false); // コピー後はモードを解除
                  }
                } else {
                  // 通常モード：ルート選択
                  onSelectRoute(route);
                }
              }}
              sx={{
                minWidth: isMobile ? 150 : 200,
                maxWidth: isMobile ? 180 : 250,
                backgroundColor: isCopyMode 
                  ? "warning.light" 
                  : isSelected ? "grey.100" : "background.paper",
                border: isCopyMode 
                  ? 2 
                  : isSelected ? 2 : 1,
                borderStyle: isCopyMode ? "dashed" : "solid",
                borderColor: isCopyMode 
                  ? "warning.main" 
                  : isSelected ? "primary.main" : "divider",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
                userSelect: "none",
                opacity: isCopyMode ? 0.9 : 1,
                '&:hover': {
                  transform: !isSelected ? 'translateY(-1px)' : 'none',
                  boxShadow: isSelected ? 4 : 2,
                }
              }}
            >
              {/* コピーモードインジケーター */}
              {isCopyMode && (
                <Chip
                  icon={<CopyIcon />}
                  size="small"
                  color="warning"
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    fontSize: "0.6rem",
                    '& .MuiChip-icon': {
                      fontSize: '0.8rem'
                    }
                  }}
                />
              )}

              {/* アクションボタン */}
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 0.5,
                }}
              >
                <Tooltip title="編集">
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditRoute(route);
                    }}
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: "warning.main",
                      color: "white",
                      '&:hover': {
                        backgroundColor: "warning.dark",
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="削除">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRoute(route.id, route.name);
                    }}
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: "error.main",
                      color: "white",
                      '&:hover': {
                        backgroundColor: "error.dark",
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* ルート情報 */}
              <CardContent sx={{ pr: 6, pb: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography
                  variant="subtitle2"
                  component="h4"
                  fontWeight="bold"
                  color={isSelected ? "primary.main" : "text.primary"}
                  sx={{
                    mb: 1,
                    fontSize: isMobile ? "0.75rem" : "0.875rem",
                    lineHeight: 1.2,
                  }}
                >
                  {route.name}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    fontSize: isMobile ? "0.6rem" : "0.75rem",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography component="span">📏</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDistance(route.distance)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography component="span">⏱️</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDuration(route.duration || 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography component="span">📍</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {route.route_data.coordinates?.length || 0}ポイント
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default RouteOverlay;
