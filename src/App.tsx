import React, { useEffect, useState, useRef } from "react";
import GoogleMap from "./components/GoogleMap";
import SaveRouteModal from "./components/SaveRouteModal";
import RouteListSidebar, { RouteListSidebarRef } from "./components/RouteListSidebar";
import RouteOverlay from "./components/RouteOverlay";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRunningRoute } from "./hooks/useRunningRoute";
import { useRouteStorage } from "./hooks/useRouteStorage";
import { RunningRoute } from "./lib/supabase";
import { RoutePoint } from "./hooks/useRunningRoute";
import "./App.css";

function App() {
  const { position, error, loading, startTracking, stopTracking, isTracking } = useGeolocation();
  const { routeState, startRecording, pauseRecording, resumeRecording, clearRoute, addPoint } =
    useRunningRoute();
  const {
    saveRoute,
    updateRoute,
    deleteRoute,
    loadUserRoutes,
    isLoading: isSaving,
  } = useRouteStorage();
  const [isManualMode, setIsManualMode] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loadedRoute, setLoadedRoute] = useState<RoutePoint[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableRoute, setEditableRoute] = useState<RoutePoint[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const routeListRef = useRef<RouteListSidebarRef>(null);
  const [allRoutes, setAllRoutes] = useState<RunningRoute[]>([]);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<RunningRoute[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // デフォルトの位置（東京駅）
  const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503,
  };

  // 現在位置があれば使用、なければデフォルト
  const mapCenter = position ? { lat: position.lat, lng: position.lng } : defaultCenter;
  const userPosition = position ? { lat: position.lat, lng: position.lng } : null;

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

  // マップオーバーレイボタンの共通スタイル
  const overlayButtonStyle = {
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    color: "white",
  } as const;

  const getButtonStyle = (bgColor: string) => ({
    ...overlayButtonStyle,
    backgroundColor: `rgba(${bgColor}, 0.9)`,
  });

  // トースト通知表示関数
  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000); // 3秒後に非表示
  };

  // GPS位置が更新されたらルートに追加（手動モードでない場合）
  useEffect(() => {
    if (position && routeState.isRecording && !isManualMode) {
      addPoint(position);
    }
  }, [position, routeState.isRecording, addPoint, isManualMode]);

  // 地図クリック処理：手動モードまたは編集モード
  const handleMapClick = (lat: number, lng: number) => {
    console.log("handleMapClick called at:", lat, lng, "isDragging:", isDragging);

    // ドラッグ中またはドラッグ直後はクリックを無視
    if (isDragging) {
      console.log("Map click ignored - dragging in progress");
      return;
    }

    if (isManualMode && routeState.isRecording) {
      // 手動モード：クリックでポイント追加（editableRouteも同時更新）
      const manualPosition = {
        lat,
        lng,
        accuracy: 5, // 高精度設定
        timestamp: Date.now(),
      };
      addPoint(manualPosition);
      setEditableRoute((prevRoute) => [...prevRoute, manualPosition]);
    } else if (isEditMode) {
      // 編集モード：クリックでピンを追加
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };
      setEditableRoute((prevRoute) => [...prevRoute, newPoint]);
    }
  };

  // 距離をフォーマット
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  // 時間をフォーマット
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

  // ペースを計算（分/km）
  const calculatePace = () => {
    if (routeState.distance === 0 || routeState.duration === 0) return "--:--";
    const kmDistance = routeState.distance / 1000;
    const minutesDuration = routeState.duration / 60000;
    const pace = minutesDuration / kmDistance;
    const paceMinutes = Math.floor(pace);
    const paceSeconds = Math.floor((pace - paceMinutes) * 60);
    return `${paceMinutes}:${paceSeconds.toString().padStart(2, "0")}`;
  };

  // ルート保存処理
  const handleSaveRoute = async (name: string, description?: string) => {
    try {
      // 手動作成モード時はeditableRouteを使用
      const routeToSave = isManualMode ? editableRoute : routeState.route;

      // 距離を再計算
      const calculateTotalDistance = (points: RoutePoint[]) => {
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
          const R = 6371000; // 地球の半径（メートル）
          const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
          const dLng = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((points[i - 1].lat * Math.PI) / 180) *
              Math.cos((points[i].lat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistance += R * c;
        }
        return totalDistance;
      };

      const distance = isManualMode ? calculateTotalDistance(editableRoute) : routeState.distance;
      const duration = isManualMode ? 0 : routeState.duration; // 手動作成時は時間なし

      await saveRoute(name, description, routeToSave, distance, duration);

      // サイドバーのルート一覧を更新
      if (routeListRef.current) {
        await routeListRef.current.refreshRoutes();
      }

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
      } catch (error) {
        console.error('ルート一覧更新エラー:', error);
      }

      // 保存成功のトースト表示
      showToast("ルートが正常に保存されました！", "success");

      // 保存成功後はルートをクリア
      clearRoute();
      setLoadedRoute([]);
      setEditableRoute([]);
      setIsManualMode(false); // 手動作成モード終了
    } catch (error) {
      // エラーはSaveRouteModalで表示される
      throw error;
    }
  };

  // 保存済みルートを読み込み
  const handleLoadRoute = (route: RunningRoute) => {
    // GeoJSON LineStringをRoutePointに変換
    const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
      lat: coord[1],
      lng: coord[0],
      timestamp: Date.now() + index * 1000, // 仮のタイムスタンプ
      accuracy: route.elevation_data?.[index] || 5,
    }));

    setSelectedRouteId(route.id); // 選択されたルートIDを設定
    clearRoute(); // 現在の記録をクリア
    setIsEditMode(false); // 編集モード無効

    // 選択されたルートデータは常に保持（編集のため）
    setLoadedRoute(routePoints);
    setEditableRoute([...routePoints]);
  };

  // 全ルート表示のON/OFF切り替え
  const handleToggleAllRoutes = (routes: RunningRoute[]) => {
    setAllRoutes(routes);
    const newShowAllRoutes = !showAllRoutes;
    setShowAllRoutes(newShowAllRoutes);
    setIsEditMode(false);
    clearRoute();

    // 選択されたルートのデータは常に保持（編集のため）
    // 表示の制御はroutePointsプロパティで行う
  };

  // ルート一覧更新のコールバック
  const handleRoutesUpdate = (routes: RunningRoute[]) => {
    setSavedRoutes(routes);
  };

  // 初期ルート読み込み
  useEffect(() => {
    const loadInitialRoutes = async () => {
      try {
        const routes = await loadUserRoutes();
        setSavedRoutes(routes);
      } catch (error) {
        console.error("初期ルート読み込みエラー:", error);
      }
    };

    loadInitialRoutes();
  }, []);

  // 手動作成開始
  const handleStartManualCreation = () => {
    // 現在の状態をクリア
    clearRoute();
    setIsEditMode(false);
    setShowAllRoutes(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute([]);

    // 手動作成モードで記録開始
    setIsManualMode(true);
    startRecording();
  };

  // 編集モード開始
  const startEditMode = (route?: RunningRoute) => {
    if (route) {
      // ルートが指定された場合は先に読み込む
      handleLoadRoute(route);
      // 少し遅延させて読み込み完了を待つ
      setTimeout(() => {
        setIsManualMode(false);
        setIsEditMode(true);
        setShowAllRoutes(false);
      }, 100);
    } else if (loadedRoute.length > 0) {
      // 手動作成モードを終了
      setIsManualMode(false);

      // 現在表示中のルートを編集対象とする
      setEditableRoute([...loadedRoute]);
      setIsEditMode(true);
      setShowAllRoutes(false); // 編集時は個別表示に切り替え
    }
  };

  // 編集モード終了
  const stopEditMode = () => {
    setIsEditMode(false);
    setEditableRoute([]);
  };

  // 編集モードで適用
  const applyEdit = async () => {
    if (editableRoute.length === 0 || !selectedRouteId) return;

    try {
      // 編集されたルートの距離を再計算
      const calculateTotalDistance = (points: RoutePoint[]) => {
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
          const R = 6371000; // 地球の半径（メートル）
          const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
          const dLng = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((points[i - 1].lat * Math.PI) / 180) *
              Math.cos((points[i].lat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistance += R * c;
        }
        return totalDistance;
      };

      const newDistance = calculateTotalDistance(editableRoute);
      const estimatedDuration = Math.floor(newDistance / 3); // 推定時間（秒）

      // 既存ルートを更新
      await updateRoute(
        selectedRouteId,
        editableRoute,
        newDistance,
        estimatedDuration * 1000 // 秒をミリ秒に変換
      );

      // 成功後に状態を更新
      setLoadedRoute([...editableRoute]);
      setIsEditMode(false);
      setEditableRoute([]);

      // サイドバーのルート一覧を更新
      if (routeListRef.current) {
        await routeListRef.current.refreshRoutes();
      }

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
      } catch (error) {
        console.error('ルート一覧更新エラー:', error);
      }

      showToast("ルートが正常に更新されました！", "success");
    } catch (error) {
      console.error("ルート更新エラー:", error);
      showToast("ルートの更新に失敗しました。もう一度お試しください。", "error");
    }
  };

  // ポイントドラッグ処理（ちらつき防止のため参照を保持）
  const handlePointDrag = React.useCallback(
    (index: number, lat: number, lng: number) => {
      if (isEditMode || (isManualMode && routeState.isRecording)) {
        setEditableRoute((prevRoute) => {
          const newRoute = [...prevRoute];
          newRoute[index] = {
            ...newRoute[index],
            lat,
            lng,
          };
          return newRoute;
        });
      }
    },
    [isEditMode, isManualMode, routeState.isRecording]
  );

  // ポイント削除処理
  const handlePointDelete = React.useCallback(
    (index: number) => {
      if (isEditMode || (isManualMode && routeState.isRecording)) {
        setEditableRoute((prevRoute) => prevRoute.filter((_, i) => i !== index));
      }
    },
    [isEditMode, isManualMode, routeState.isRecording]
  );

  // ドラッグ状態管理のコールバック
  const handleDragStart = React.useCallback(() => {
    console.log("App handleDragStart called");
    setIsDragging(true);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    console.log("App handleDragEnd called");
    // 短時間の遅延後にドラッグ状態をリセット
    setTimeout(() => {
      console.log("App drag state reset after timeout");
      setIsDragging(false);
    }, 300); // 300msに調整
  }, []);

  // ルート削除処理
  const handleRouteDelete = async (routeId: string, routeName: string) => {
    if (!window.confirm(`「${routeName}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      await deleteRoute(routeId);

      // 削除されたルートが現在選択中の場合、状態をクリア
      if (selectedRouteId === routeId) {
        setSelectedRouteId(undefined);
        setLoadedRoute([]);
        setEditableRoute([]);
        setIsEditMode(false);
      }

      // オーバーレイのルート一覧を更新
      setSavedRoutes(prevRoutes => prevRoutes.filter(route => route.id !== routeId));

      // サイドバーのルート一覧を更新
      if (routeListRef.current) {
        await routeListRef.current.refreshRoutes();
      }

      showToast("ルートが削除されました。", "success");
    } catch (error) {
      console.error("ルート削除エラー:", error);
      showToast("ルートの削除に失敗しました。もう一度お試しください。", "error");
    }
  };

  // ルート線クリック時にピンを挿入
  const handleRouteLineClick = React.useCallback(
    (lat: number, lng: number) => {
      console.log("handleRouteLineClick called at:", lat, lng, "isDragging:", isDragging);
      if (!isEditMode && !(isManualMode && routeState.isRecording)) return;

      // ドラッグ中はピン挿入を無効化
      if (isDragging) {
        console.log("Route line click ignored - dragging in progress");
        return;
      }

      // 最も近いセグメントを見つけて、そこにピンを挿入
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };

      // 編集対象のルートを決定（編集モードなら編集ルート、手動作成なら作成中ルート）
      const targetRoute = isEditMode ? editableRoute : routeState.route;

      // クリックした位置に最も近いセグメントのインデックスを計算
      let minDistance = Infinity;
      let insertIndex = targetRoute.length;

      for (let i = 0; i < targetRoute.length - 1; i++) {
        const segmentDistance = getDistanceToSegment(
          lat,
          lng,
          targetRoute[i].lat,
          targetRoute[i].lng,
          targetRoute[i + 1].lat,
          targetRoute[i + 1].lng
        );

        if (segmentDistance < minDistance) {
          minDistance = segmentDistance;
          insertIndex = i + 1;
        }
      }

      setEditableRoute((prevRoute) => {
        const newRoute = [...prevRoute];
        newRoute.splice(insertIndex, 0, newPoint);
        return newRoute;
      });
    },
    [isEditMode, isManualMode, routeState.isRecording, editableRoute, routeState.route, isDragging]
  );

  // 点と線分の距離を計算
  const getDistanceToSegment = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ) => {
    const A = px - ax;
    const B = py - ay;
    const C = bx - ax;
    const D = by - ay;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = ax;
      yy = ay;
    } else if (param > 1) {
      xx = bx;
      yy = by;
    } else {
      xx = ax + param * C;
      yy = ay + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div className="App">
      <header className="App-header" style={{ position: "relative" }}>
        {/* ヘッダー左上の開閉ボタン（常に表示） */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "rgba(64, 76, 88, 0.8)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
          }}
          title={isSidebarCollapsed ? "メニューを開く" : "メニューを閉じる"}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(64, 76, 88, 1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(64, 76, 88, 0.8)";
          }}
        >
          {isSidebarCollapsed ? "☰" : "✕"}
        </button>

        <h1 style={{ margin: "5px 0", fontSize: "1.5em" }}>Running Route Tracker</h1>
        <p style={{ margin: "5px 0", fontSize: "0.9em" }}>ランニングルートを記録・共有しよう</p>
      </header>

      <div className="app-main">
        {/* サイドバー */}
        <div className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
          {!isSidebarCollapsed && (
            <RouteListSidebar
              ref={routeListRef}
              onLoadRoute={handleLoadRoute}
              onDeleteRoute={handleRouteDelete}
              onToggleAllRoutes={handleToggleAllRoutes}
              onEditRoute={() => startEditMode()}
              selectedRouteId={selectedRouteId}
              showAllRoutes={showAllRoutes}
              onRoutesUpdate={handleRoutesUpdate}
            />
          )}
        </div>

        {/* メインコンテンツ */}
        <div className="main-content">
          {/* 地図コンテナ（全画面表示） */}
          <div className="map-container">
            {/* 制御ボタンオーバーレイ */}
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxWidth: "250px",
              }}
            >
              {isEditMode && (
                <>
                  <button onClick={applyEdit} style={getButtonStyle("40, 167, 69")}>
                    💾 保存
                  </button>
                  <button onClick={stopEditMode} style={getButtonStyle("108, 117, 125")}>
                    ❌ キャンセル
                  </button>
                </>
              )}

              {loading && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(23, 162, 184, 0.9)",
                    color: "white",
                    borderRadius: "5px",
                    fontSize: "0.9em",
                  }}
                >
                  📡 位置情報取得中...
                </div>
              )}
              {error && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(220, 53, 69, 0.9)",
                    color: "white",
                    borderRadius: "5px",
                    fontSize: "0.9em",
                  }}
                >
                  ❌ {error.message}
                </div>
              )}
              {isManualMode ? (
                // 手動作成モード：保存とクリアボタンのみ
                <>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    style={getButtonStyle("40, 167, 69")}
                  >
                    💾 保存
                  </button>
                  <button
                    onClick={() => {
                      clearRoute();
                      setEditableRoute([]);
                      setIsManualMode(false); // 手動作成モード終了
                    }}
                    style={getButtonStyle("108, 117, 125")}
                  >
                    ❌ キャンセル
                  </button>
                </>
              ) : (
                // GPS記録モード：従来の制御（編集モード時は非表示）
                !isEditMode && (
                  <>
                    {!routeState.isRecording && routeState.route.length === 0 && (
                      <button
                        onClick={() => {
                          if (!isTracking) {
                            startTracking();
                          }
                          startRecording();
                        }}
                        style={getButtonStyle("0, 123, 255")}
                      >
                        🏃‍♂️ 記録開始
                      </button>
                    )}

                    {routeState.isRecording && (
                      <button onClick={pauseRecording} style={getButtonStyle("255, 193, 7")}>
                        ⏸️ 一時停止
                      </button>
                    )}

                    {!routeState.isRecording && routeState.route.length > 0 && (
                      <>
                        <button onClick={resumeRecording} style={getButtonStyle("40, 167, 69")}>
                          ▶️ 再開
                        </button>
                        <button
                          onClick={() => setShowSaveModal(true)}
                          style={getButtonStyle("40, 167, 69")}
                        >
                          💾 保存
                        </button>
                        <button
                          onClick={() => {
                            clearRoute();
                            if (isTracking) {
                              stopTracking();
                            }
                          }}
                          style={getButtonStyle("108, 117, 125")}
                        >
                          ❌ キャンセル
                        </button>
                      </>
                    )}
                  </>
                )
              )}
            </div>

            {/* モード説明 */}
            {/* {isManualMode && (
              <div
                style={{
                  backgroundColor: "#d1ecf1",
                  border: "1px solid #bee5eb",
                  borderRadius: "5px",
                  padding: "10px",
                  marginBottom: "15px",
                  fontSize: "0.9em",
                }}
              >
                ✏️ <strong>手動作成中:</strong>{" "}
                地図クリックでピン追加、ルート線クリックで間にピン挿入、ピンを左クリック&ドラッグで移動、右クリックで削除できます。作成後は保存してください。
                <br />
                🟢 スタート / 🟠 中間ポイント / 🔴 ゴール / 🩷 ドラッグ中
              </div>
            )} */}

            {/* {isEditMode && (
              <div
                style={{
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeaa7",
                  borderRadius: "5px",
                  padding: "10px",
                  marginBottom: "15px",
                  fontSize: "0.9em",
                }}
              >
                ✏️ <strong>編集モード:</strong>{" "}
                地図クリックでピン追加、ルート線クリックで間にピン挿入、ピンを左クリック&ドラッグで移動、右クリックで削除できます。
                <br />
                💾 <strong>保存して適用</strong>ボタンで編集内容が既存ルートに反映されます。
                <br />
                🟢 スタート / 🟠 中間ポイント / 🔴 ゴール / 🩷 ドラッグ中
              </div>
            )} */}

            {/* 統計情報オーバーレイ（制御ボタンの横） */}
            {(routeState.route.length > 0 || (isManualMode && editableRoute.length > 0)) && (
              <div
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "170px",
                  zIndex: 1000,
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  color: "white",
                  padding: "12px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.85em",
                  fontWeight: "bold",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  maxWidth: "220px",
                }}
              >
                <div>
                  📏 距離:{" "}
                  {isManualMode && editableRoute.length > 0
                    ? formatDistance(
                        (() => {
                          let totalDistance = 0;
                          for (let i = 1; i < editableRoute.length; i++) {
                            const R = 6371000;
                            const dLat =
                              ((editableRoute[i].lat - editableRoute[i - 1].lat) * Math.PI) / 180;
                            const dLng =
                              ((editableRoute[i].lng - editableRoute[i - 1].lng) * Math.PI) / 180;
                            const a =
                              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                              Math.cos((editableRoute[i - 1].lat * Math.PI) / 180) *
                                Math.cos((editableRoute[i].lat * Math.PI) / 180) *
                                Math.sin(dLng / 2) *
                                Math.sin(dLng / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            totalDistance += R * c;
                          }
                          return totalDistance;
                        })()
                      )
                    : formatDistance(routeState.distance)}
                </div>
                {!isManualMode && (
                  <>
                    <div>⏱️ 時間: {formatDuration(routeState.duration)}</div>
                    <div>🏃‍♂️ ペース: {calculatePace()}/km</div>
                  </>
                )}
                <div>
                  📍 ポイント数:{" "}
                  {isManualMode && editableRoute.length > 0
                    ? editableRoute.length
                    : routeState.route.length}
                </div>
              </div>
            )}

            {/* Google Maps */}
            {apiKey ? (
              <GoogleMap
                apiKey={apiKey}
                center={mapCenter}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                userPosition={userPosition}
                routePoints={
                  isEditMode
                    ? editableRoute
                    : isManualMode && editableRoute.length > 0
                    ? editableRoute
                    : routeState.route.length > 0
                    ? routeState.route
                    : showAllRoutes
                    ? []
                    : loadedRoute
                }
                isRecording={routeState.isRecording}
                onMapClick={handleMapClick}
                isDemoMode={isManualMode}
                isEditMode={isEditMode}
                onPointDrag={handlePointDrag}
                onPointDelete={handlePointDelete}
                onRouteLineClick={handleRouteLineClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                allRoutes={allRoutes}
                showAllRoutes={showAllRoutes}
                selectedRouteId={selectedRouteId}
                onRouteSelect={handleLoadRoute}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f0f0f0",
                  color: "#666",
                }}
              >
                Google Maps API キーを設定してください
              </div>
            )}

            {/* ルートオーバーレイ */}
            <RouteOverlay
              routes={savedRoutes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={handleLoadRoute}
              onEditRoute={startEditMode}
              onDeleteRoute={handleRouteDelete}
              onToggleAllRoutes={handleToggleAllRoutes}
              showAllRoutes={showAllRoutes}
              onStartManualCreation={handleStartManualCreation}
            />
          </div>
        </div>
      </div>

      {/* トースト通知 */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            backgroundColor:
              toastMessage.type === "success"
                ? "rgba(40, 167, 69, 0.95)"
                : "rgba(220, 53, 69, 0.95)",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "1em",
            fontWeight: "bold",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            animation: "slideDown 0.3s ease-out",
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          {toastMessage.type === "success" ? "✅" : "❌"} {toastMessage.message}
        </div>
      )}

      {/* ルート保存モーダル */}
      <SaveRouteModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveRoute}
        distance={routeState.distance}
        duration={routeState.duration}
        isLoading={isSaving}
      />
    </div>
  );
}

export default App;
