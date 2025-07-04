import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { RunningRoute } from "../lib/supabase";
import { useRouteStorage } from "../hooks/useRouteStorage";

interface RouteListSidebarProps {
  onLoadRoute: (route: RunningRoute) => void;
  onDeleteRoute: (routeId: string, routeName: string) => void;
  onToggleAllRoutes?: (routes: RunningRoute[]) => void;
  onEditRoute?: () => void;
  selectedRouteId?: string;
  showAllRoutes?: boolean;
  onRoutesUpdate?: (routes: RunningRoute[]) => void;
  editingRouteId?: string | null;
  editingRouteName?: string;
  onStartEditRouteName?: (route: RunningRoute) => void;
  onCancelEditRouteName?: () => void;
  onSaveRouteName?: (routeId: string) => void;
  onEditingRouteNameChange?: (name: string) => void;
}

export interface RouteListSidebarRef {
  refreshRoutes: () => Promise<void>;
}

const RouteListSidebar = forwardRef<RouteListSidebarRef, RouteListSidebarProps>(
  (
    {
      onLoadRoute,
      onDeleteRoute,
      onToggleAllRoutes,
      onEditRoute,
      selectedRouteId,
      showAllRoutes = false,
      onRoutesUpdate,
      editingRouteId,
      editingRouteName,
      onStartEditRouteName,
      onCancelEditRouteName,
      onSaveRouteName,
      onEditingRouteNameChange,
    },
    ref
  ) => {
    const { loadUserRoutes, isLoading } = useRouteStorage();
    const [routes, setRoutes] = useState<RunningRoute[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const loadRoutes = async () => {
      try {
        setError(null);
        const userRoutes = await loadUserRoutes();
        setRoutes(userRoutes);
        if (onRoutesUpdate) {
          onRoutesUpdate(userRoutes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "ルートの読み込みに失敗しました");
      }
    };

    useEffect(() => {
      loadRoutes();
    }, []);

    // ウィンドウリサイズ監視
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // 削除処理をラップして、削除後に一覧を更新
    const handleDeleteWithRefresh = async (routeId: string, routeName: string) => {
      try {
        onDeleteRoute(routeId, routeName);
        // 削除後にルート一覧を再読み込み
        await loadRoutes();
      } catch (error) {
        // エラーは親コンポーネントで処理されるため、ここでは再読み込みのみ実行
        await loadRoutes();
      }
    };


    // refから呼び出せるメソッドを公開
    useImperativeHandle(ref, () => ({
      refreshRoutes: loadRoutes,
    }));

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

        {/* 全て表示ボタン - UX重視の配置 */}
        {routes.length > 1 && onToggleAllRoutes && (
          <div style={{ 
            marginBottom: "20px",
            padding: "15px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #e9ecef",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div style={{ 
              marginBottom: "8px",
              fontSize: "0.9em",
              color: "#495057",
              fontWeight: "500"
            }}>
              📂 {routes.length}個のルートがあります
            </div>
            <button
              onClick={() => onToggleAllRoutes(routes)}
              style={{
                width: "100%",
                padding: "10px 15px",
                backgroundColor: showAllRoutes ? "#dc3545" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "1em",
                fontWeight: "bold",
                transition: "background-color 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showAllRoutes ? "#c82333" : "#218838";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showAllRoutes ? "#dc3545" : "#28a745";
              }}
            >
              {showAllRoutes ? "🔍 個別表示に戻る" : "🗺️ 全ルートを地図に表示"}
            </button>
          </div>
        )}


        <div style={{ flex: 1, overflow: "auto" }}>
          {isLoading && (
            <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
              📡 読み込み中...
            </div>
          )}

          {error && (
            <div
              style={{
                color: "#dc3545",
                backgroundColor: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: "5px",
                padding: "10px",
                marginBottom: "15px",
                fontSize: "0.9em",
              }}
            >
              {error}
            </div>
          )}

          {!isLoading && !error && routes.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#6c757d",
                fontSize: "0.9em",
              }}
            >
              まだ保存されたルートがありません
            </div>
          )}

          {routes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const isInactive = showAllRoutes && !isSelected;

            return (
              <div
                key={route.id}
                style={{
                  border: isSelected ? "2px solid #007bff" : "1px solid #e9ecef",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "10px",
                  transition: "all 0.2s",
                  backgroundColor: isSelected ? "#f0f8ff" : "#ffffff",
                  fontSize: "0.9em",
                  position: "relative",
                  opacity: isInactive ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                  }
                }}
              >
                {/* 編集ボタン */}
                {onEditRoute && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 選択されていない場合は先に読み込む
                      if (!isSelected) {
                        onLoadRoute(route);
                      }
                      onEditRoute();
                    }}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "36px",
                      background: "#fd7e14",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      cursor: "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e96600";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fd7e14";
                    }}
                    title={`${route.name}を編集`}
                  >
                    ✏️
                  </button>
                )}

                {/* 削除ボタン */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWithRefresh(route.id, route.name);
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#c82333";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#dc3545";
                  }}
                  title={`${route.name}を削除`}
                >
                  ×
                </button>

                {/* ルート情報（クリック可能エリア） */}
                <div
                  onClick={() => onLoadRoute(route)}
                  style={{ cursor: "pointer", paddingRight: onEditRoute ? "64px" : "30px" }}
                >
                  <div
                    style={{
                      marginBottom: isMobile ? "4px" : "8px",
                    }}
                  >
                    {editingRouteId === route.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                        <input
                          type="text"
                          value={editingRouteName}
                          onChange={(e) => onEditingRouteNameChange?.(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onSaveRouteName?.(route.id);
                            } else if (e.key === "Escape") {
                              onCancelEditRouteName?.();
                            }
                          }}
                          style={{
                            flex: 1,
                            fontSize: isMobile ? "0.9em" : "1em",
                            fontWeight: "bold",
                            color: "#007bff",
                            border: "1px solid #007bff",
                            borderRadius: "3px",
                            padding: "2px 5px",
                            outline: "none",
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => onSaveRouteName?.(route.id)}
                          style={{
                            padding: "2px 6px",
                            fontSize: "0.7em",
                            border: "none",
                            borderRadius: "3px",
                            backgroundColor: "#28a745",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={onCancelEditRouteName}
                          style={{
                            padding: "2px 6px",
                            fontSize: "0.7em",
                            border: "none",
                            borderRadius: "3px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <h4
                        style={{
                          margin: "0 0 5px 0",
                          color: "#007bff",
                          fontSize: isMobile ? "0.9em" : "1em",
                          fontWeight: "bold",
                        }}
                        onDoubleClick={() => onStartEditRouteName?.(route)}
                        title="ダブルクリックで編集"
                      >
                        {route.name}
                      </h4>
                    )}
                    {!isMobile && (
                      <span
                        style={{
                          fontSize: "0.8em",
                          color: "#6c757d",
                        }}
                      >
                        {formatDate(route.created_at)}
                      </span>
                    )}
                  </div>

                  {!isMobile && route.description && (
                    <p
                      style={{
                        margin: "0 0 8px 0",
                        color: "#6c757d",
                        fontSize: "0.8em",
                        lineHeight: 1.3,
                      }}
                    >
                      {route.description}
                    </p>
                  )}

                  {!isMobile && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        fontSize: "0.8em",
                        color: "#495057",
                      }}
                    >
                      <div>📏 {formatDistance(route.distance)}</div>
                      <div>⏱️ {formatDuration(route.duration || 0)}</div>
                      <div>📍 {route.route_data.coordinates?.length || 0}ポイント</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {routes.length > 0 && (
          <div
            style={{
              marginTop: "15px",
              textAlign: "center",
              fontSize: "0.8em",
              color: "#6c757d",
              paddingTop: "15px",
              borderTop: "1px solid #e9ecef",
            }}
          >
            ルートをクリックして地図に表示
          </div>
        )}
      </div>
    );
  }
);

export default RouteListSidebar;
