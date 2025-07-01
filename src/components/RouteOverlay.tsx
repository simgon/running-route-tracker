import React, { useEffect, useRef } from "react";
import { RunningRoute } from "../lib/supabase";
import "./RouteOverlay.css";

interface RouteOverlayProps {
  routes: RunningRoute[];
  selectedRouteId?: string;
  onSelectRoute: (route: RunningRoute) => void;
  onEditRoute: (route: RunningRoute) => void;
  onDeleteRoute: (routeId: string, routeName: string) => void;
  onToggleAllRoutes?: (routes: RunningRoute[]) => void;
  showAllRoutes?: boolean;
  onStartManualCreation?: () => void;
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
}) => {
  const isMobile = window.innerWidth <= 768;
  const [isDragging, setIsDragging] = React.useState(false);
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
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        backdropFilter: "blur(3px)",
        maxHeight: "200px",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          color: "#333",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          📂 保存済みルート ({routes.length}個)
        </div>

        {/* 全ルート表示ボタン */}
        {routes.length > 1 && onToggleAllRoutes && (
          <button
            onClick={() => onToggleAllRoutes(routes)}
            style={{
              padding: "6px 12px",
              backgroundColor: showAllRoutes ? "#dc3545" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
              transition: "background-color 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = showAllRoutes ? "#c82333" : "#218838";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showAllRoutes ? "#dc3545" : "#28a745";
            }}
            title={showAllRoutes ? "個別表示に戻る" : "全ルートを地図に表示"}
          >
            {showAllRoutes ? "🔍 個別表示" : "🗺️ 全表示"}
          </button>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "8px",
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
        {/* 新規ルート作成ボタン */}
        {onStartManualCreation && (
          <div
            onClick={(e) => {
              if (isDragging) {
                e.preventDefault();
                return;
              }
              onStartManualCreation();
            }}
            style={{
              minWidth: isMobile ? "150px" : "200px",
              maxWidth: isMobile ? "180px" : "250px",
              backgroundColor: "#e8f5e8",
              border: "2px dashed #28a745",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "#28a745",
              fontWeight: "bold",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#d4edda";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#e8f5e8";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ fontSize: isMobile ? "20px" : "24px", marginBottom: "8px" }}>✏️</div>
            <div style={{ fontSize: isMobile ? "12px" : "14px" }}>新規ルート作成</div>
          </div>
        )}

        {routes.map((route) => {
          const isSelected = selectedRouteId === route.id;

          return (
            <div
              key={route.id}
              ref={(el) => {
                routeRefsRef.current[route.id] = el;
              }}
              onClick={(e) => {
                if (isDragging) {
                  e.preventDefault();
                  return;
                }
                onSelectRoute(route);
              }}
              style={{
                minWidth: isMobile ? "150px" : "200px",
                maxWidth: isMobile ? "180px" : "250px",
                backgroundColor: isSelected ? "#e3f2fd" : "#f8f9fa",
                border: isSelected ? "2px solid #2196f3" : "1px solid #e9ecef",
                borderRadius: "8px",
                padding: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                position: "relative",
                boxShadow: isSelected
                  ? "0 2px 8px rgba(33,150,243,0.3)"
                  : "0 1px 3px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {/* アクションボタン */}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  display: "flex",
                  gap: "4px",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRoute(route);
                  }}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "none",
                    backgroundColor: "#ff9800",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f57c00";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ff9800";
                  }}
                  title="編集"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRoute(route.id, route.name);
                  }}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "none",
                    backgroundColor: "#f44336",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#d32f2f";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f44336";
                  }}
                  title="削除"
                >
                  ×
                </button>
              </div>

              {/* ルート情報 */}
              <div style={{ paddingRight: "50px" }}>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: isMobile ? "12px" : "14px",
                    fontWeight: "bold",
                    color: isSelected ? "#1976d2" : "#333",
                    lineHeight: "1.2",
                  }}
                >
                  {route.name}
                </h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: isMobile ? "10px" : "12px",
                    color: "#666",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>📏</span>
                    <span>{formatDistance(route.distance)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>⏱️</span>
                    <span>{formatDuration(route.duration || 0)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>📍</span>
                    <span>{route.route_data.coordinates?.length || 0}ポイント</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteOverlay;
