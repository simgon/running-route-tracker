import React, { useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  Visibility as ViewAllIcon,
  VisibilityOff,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  KeyboardArrowUp,
  KeyboardArrowDown,
  Timeline,
  Schedule as TimeIcon,
  DragHandle,
  Height as ResizeIcon,
  Add as AddIcon,
  SmartToy as AIIcon,
  Create as CreateIcon,
} from "@mui/icons-material";
import { RunningRoute } from "../../lib/supabase";

interface RouteOverlayProps {
  routes: RunningRoute[];
  selectedRouteId?: string;
  onSelectRoute: (route: RunningRoute) => void;
  onEditRoute: (route: RunningRoute) => void;
  onDeleteRoute: (routeId: string, routeName: string) => void;
  onToggleAllRoutes?: () => void;
  onStartManualCreation?: () => void;
  onStartAIGeneration?: () => void;
  onStartRouteCopy?: (route: RunningRoute) => void;
  visibleRoutes?: Set<string>;
  onToggleRouteVisibility?: (routeId: string) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onReorderRoutes?: (newOrder: RunningRoute[]) => void;
  overlayHeight?: number;
  onHeightChange?: (height: number) => void;
  isCreationMode?: boolean;
  isEditMode?: boolean;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onEditRoute,
  onDeleteRoute,
  onToggleAllRoutes,
  onStartManualCreation,
  onStartAIGeneration,
  onStartRouteCopy,
  visibleRoutes = new Set(),
  onToggleRouteVisibility,
  isExpanded = false,
  onToggleExpanded,
  onReorderRoutes,
  overlayHeight = 180,
  onHeightChange,
  isCreationMode = false,
  isEditMode = false,
}) => {
  const isMobile = window.innerWidth <= 768;
  const [isDragging, setIsDragging] = React.useState(false);
  const [isCopyMode, setIsCopyMode] = React.useState(false);
  const [draggedRoute, setDraggedRoute] = React.useState<RunningRoute | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeStartY, setResizeStartY] = React.useState(0);
  const [resizeStartHeight, setResizeStartHeight] = React.useState(overlayHeight);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const routeRefsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
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

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (
    e: React.DragEvent,
    route: RunningRoute,
    fromHandle: boolean = false
  ) => {
    if (isCopyMode || !fromHandle) {
      e.preventDefault();
      return;
    }
    setDraggedRoute(route);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", route.id);
    
    // ドラッグ中はスクロールを無効化
    const scrollContainer = document.querySelector('[data-route-scroll-container]') as HTMLElement;
    if (scrollContainer) {
      scrollContainer.style.overflowY = 'hidden';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggedRoute || !onReorderRoutes) return;

    const draggedIndex = routes.findIndex((route) => route.id === draggedRoute.id);
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedRoute(null);
      setDragOverIndex(null);
      return;
    }

    // 新しい順序を作成
    const newRoutes = [...routes];
    const [removed] = newRoutes.splice(draggedIndex, 1);
    newRoutes.splice(dropIndex, 0, removed);

    onReorderRoutes(newRoutes);
    setDraggedRoute(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedRoute(null);
    setDragOverIndex(null);
    
    // スクロールを再有効化
    const scrollContainer = document.querySelector('[data-route-scroll-container]') as HTMLElement;
    if (scrollContainer) {
      scrollContainer.style.overflowY = 'auto';
    }
    
    // ドラッグ終了後の短時間、クリックイベントを無効化
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  // リサイザーハンドラー
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setResizeStartY(clientY);
    setResizeStartHeight(overlayHeight);
  };

  const handleResizeMove = React.useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing || !onHeightChange) return;

      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = resizeStartY - clientY; // 上方向に移動で高さ増加
      const newHeight = Math.max(
        120,
        Math.min(window.innerHeight * 0.8, resizeStartHeight + deltaY)
      );

      onHeightChange(newHeight);
    },
    [isResizing, resizeStartY, resizeStartHeight, onHeightChange]
  );

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  // グローバルマウス/タッチイベントの管理
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.addEventListener("touchmove", handleResizeMove, { passive: false });
      document.addEventListener("touchend", handleResizeEnd);

      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.removeEventListener("touchmove", handleResizeMove);
        document.removeEventListener("touchend", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // 選択されたルートにスクロール
  useEffect(() => {
    if (selectedRouteId && scrollContainerRef.current && routeRefsRef.current[selectedRouteId]) {
      const container = scrollContainerRef.current;
      const selectedElement = routeRefsRef.current[selectedRouteId];

      if (selectedElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();

        // 要素が表示範囲外の場合にスクロール
        const isVisible =
          elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;

        if (!isVisible) {
          const scrollLeft =
            selectedElement.offsetLeft -
            container.offsetLeft -
            container.clientWidth / 2 +
            selectedElement.clientWidth / 2;

          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: "smooth",
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
        width: isExpanded ? "95%" : "90%",
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 3,
        p: 2,
        boxShadow: 4,
        backdropFilter: "blur(10px)",
        maxHeight: isExpanded ? overlayHeight : 180, // 拡張時のみ動的な高さ
      }}
    >
      {/* リサイザーハンドル - 拡張時のみ表示 */}
      {onHeightChange && isExpanded && (
        <Box
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          sx={{
            position: "absolute",
            top: -2,
            left: "50%",
            transform: "translateX(-50%)",
            width: 60,
            height: 8,
            backgroundColor: "rgba(0,0,0,0.2)",
            borderRadius: "0 0 4px 4px",
            cursor: "ns-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
            touchAction: "none", // タッチスクロールも無効化
            "&:hover": {
              backgroundColor: "rgba(0,0,0,0.3)",
            },
          }}
          draggable={false}
        >
          <ResizeIcon
            sx={{
              fontSize: "12px",
              color: "white",
              transform: "rotate(90deg)",
            }}
          />
        </Box>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1.5,
          position: "relative",
        }}
      >
        {/* 全表示ボタン - 左（編集・作成時は非表示） */}
        {routes.length > 1 && onToggleAllRoutes && !isCreationMode && !isEditMode && (
          <Button
            variant={visibleRoutes.size === routes.length ? "contained" : "outlined"}
            color={visibleRoutes.size === routes.length ? "error" : "success"}
            size="small"
            startIcon={visibleRoutes.size === routes.length ? <VisibilityOff /> : <ViewAllIcon />}
            onClick={onToggleAllRoutes}
            sx={{
              textTransform: "none",
              fontWeight: "bold",
              fontSize: "0.75rem",
              position: "absolute",
              left: 0,
            }}
          >
            {visibleRoutes.size === routes.length ? "全非表示" : "全表示"}
          </Button>
        )}

        {/* 拡張ボタン - 中央 */}
        {onToggleExpanded && (
          <IconButton
            onClick={onToggleExpanded}
            size="small"
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.9)",
              },
            }}
          >
            {isExpanded ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
          </IconButton>
        )}
      </Box>

      <Box
        ref={scrollContainerRef}
        data-route-scroll-container
        sx={{
          display: isExpanded ? "grid" : "flex",
          gridTemplateColumns: isExpanded
            ? `repeat(auto-fill, minmax(${isMobile ? "150px" : "200px"}, 1fr))`
            : undefined,
          gap: 1.5,
          overflowX: isExpanded ? "visible" : "auto",
          overflowY: isExpanded ? "auto" : "visible",
          pb: 1,
          scrollbarWidth: "none", // Firefox
          msOverflowStyle: "none", // IE/Edge
          cursor: isExpanded ? "default" : "grab",
          maxHeight: isExpanded ? `${overlayHeight - 100}px` : undefined, // ヘッダー分を除く
          // デスクトップでのグリッド表示時の重複を防ぐ
          ...(isExpanded && {
            overflow: "auto",
            height: `${overlayHeight - 100}px`,
          }),
        }}
        className="route-scroll-container"
        onMouseDown={
          !isExpanded
            ? (e) => {
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
              }
            : undefined
        }
      >
        {/* 新規ルート作成/コピーボタン */}
        {onStartManualCreation && (
          <div
            style={{
              minWidth: isMobile ? "155px" : "200px",
              maxWidth: isMobile ? "155px" : "250px",
              minHeight: isMobile ? "100px" : "110px",
              maxHeight: isMobile ? "120px" : "130px",
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
            <Tooltip title={isCopyMode ? "手動作成モードに切り替え" : "コピーモードに切り替え"}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDragging) return;
                  setIsCopyMode(!isCopyMode);
                }}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  backgroundColor: isCopyMode ? "warning.main" : "success.main",
                  color: "white",
                  "&:hover": {
                    backgroundColor: isCopyMode ? "warning.dark" : "success.dark",
                  },
                }}
              >
                {isCopyMode ? (
                  <CreateIcon sx={{ fontSize: 16 }} />
                ) : (
                  <CopyIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>

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
              style={{ width: "100%", height: "auto" }}
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
                {isCopyMode ? (
                  <CopyIcon sx={{ fontSize: "inherit" }} />
                ) : (
                  <AddIcon sx={{ fontSize: "inherit" }} />
                )}
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
              minWidth: isMobile ? "155px" : "200px",
              maxWidth: isMobile ? "155px" : "250px",
              minHeight: isMobile ? "100px" : "110px",
              maxHeight: isMobile ? "120px" : "130px",
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
            <div style={{ fontSize: isMobile ? "20px" : "24px", marginBottom: "8px" }}>
              <AIIcon sx={{ fontSize: "inherit" }} />
            </div>
            <div style={{ fontSize: isMobile ? "12px" : "14px" }}>AIルート生成</div>
          </div>
        )}

        {routes.map((route, index) => {
          const isSelected = selectedRouteId === route.id;
          const isDraggedOver = dragOverIndex === index;
          const isBeingDragged = draggedRoute?.id === route.id;

          return (
            <Card
              key={route.id}
              ref={(el) => {
                routeRefsRef.current[route.id] = el;
              }}
              draggable={false}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
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
              onTouchStart={(e) => {
                // タッチ開始時にフォーカスを無効化
                e.currentTarget.blur();
              }}
              sx={{
                minWidth: isMobile ? 155 : 200,
                maxWidth: isMobile ? 155 : 250,
                minHeight: isMobile ? 100 : 110,
                maxHeight: isMobile ? 120 : 130,
                backgroundColor: isCopyMode
                  ? "warning.light"
                  : isSelected
                  ? "grey.100"
                  : "background.paper",
                border: isCopyMode ? 2 : isSelected ? 2 : 1,
                borderStyle: isCopyMode ? "dashed" : isDraggedOver ? "dashed" : "solid",
                borderColor: isCopyMode
                  ? "warning.main"
                  : isDraggedOver
                  ? "success.main"
                  : isSelected
                  ? "primary.main"
                  : "divider",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
                userSelect: "none",
                opacity: isCopyMode ? 0.9 : isBeingDragged ? 0.5 : 1,
                transform: isDraggedOver ? "scale(1.02)" : "none",
                boxShadow: isDraggedOver ? 3 : isSelected ? 2 : 1,
                // スマホでのフォーカス状態を無効化
                "&:focus": {
                  outline: "none",
                },
                "&:focus-visible": {
                  outline: "none",
                },
                // タッチ時のハイライトを無効化
                "-webkit-tap-highlight-color": "transparent",
                "&:hover": {
                  transform:
                    !isSelected && !isDraggedOver
                      ? "translateY(-1px)"
                      : isDraggedOver
                      ? "scale(1.02)"
                      : "none",
                  boxShadow: isSelected ? 4 : 2,
                  "& .action-buttons": {
                    opacity: 1,
                    visibility: "visible",
                  },
                },
                "&:active": {
                  cursor: "pointer",
                },
              }}
            >
              {/* 表示/非表示ボタン */}
              {!isCopyMode && onToggleRouteVisibility && (
                <Tooltip title={visibleRoutes.has(route.id) ? "非表示にする" : "表示する"}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRouteVisibility(route.id);
                    }}
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 24,
                      height: 24,
                      backgroundColor: visibleRoutes.has(route.id) ? "success.main" : "grey.400",
                      color: "white",
                      "&:hover": {
                        backgroundColor: visibleRoutes.has(route.id) ? "success.dark" : "grey.600",
                      },
                    }}
                  >
                    {visibleRoutes.has(route.id) ? (
                      <VisibilityIcon fontSize="small" />
                    ) : (
                      <VisibilityOffIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}

              {/* ドラッグハンドル - ヘッダー中央 */}
              {!isCopyMode && onReorderRoutes && (
                <IconButton
                  size="small"
                  draggable
                  onDragStart={(e) => handleDragStart(e, route, true)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: isMobile ? 20 : 24,
                    height: isMobile ? 14 : 16,
                    backgroundColor: "background.paper",
                    color: "grey.400",
                    cursor: "grab",
                    borderRadius: "4px",
                    touchAction: "none", // タッチ操作でのスクロールを無効化
                    "&:hover": {
                      backgroundColor: "grey.100",
                    },
                    "&:active": {
                      cursor: "grabbing",
                    },
                  }}
                >
                  <DragHandle sx={{ fontSize: "14px" }} />
                </IconButton>
              )}

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
                    "& .MuiChip-icon": {
                      fontSize: "0.8rem",
                    },
                  }}
                />
              )}

              {/* アクションボタン */}
              {!isCopyMode && (
                <Box
                  className="action-buttons"
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    display: "flex",
                    gap: 0.5,
                    opacity: 0,
                    visibility: "hidden",
                    transition: "opacity 0.2s ease, visibility 0.2s ease",
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
                        "&:hover": {
                          backgroundColor: "warning.dark",
                        },
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
                        "&:hover": {
                          backgroundColor: "error.dark",
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* ルート情報 */}
              <CardContent
                sx={{
                  pr: 1.5,
                  pt: !isCopyMode && onReorderRoutes ? (isMobile ? 3 : 3.5) : 1, // ドラッグハンドルがある場合は上部余白を追加（モバイル対応）
                  pb: 1,
                  px: 1.5,
                  "&:last-child": { pb: 1 },
                  overflow: "hidden",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="subtitle2"
                  component="h4"
                  fontWeight="bold"
                  color={isSelected ? "primary.main" : "text.primary"}
                  sx={{
                    mb: 0.5,
                    fontSize: isMobile ? "0.7rem" : "0.8rem",
                    lineHeight: 1.1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {route.name}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                    fontSize: isMobile ? "0.55rem" : "0.65rem",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Timeline fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {formatDistance(route.distance)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <TimeIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {formatDuration(route.duration || 0)}
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
