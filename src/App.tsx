import React, { useEffect, useState, useRef } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { DirectionsRun, Person } from "@mui/icons-material";
import GoogleMap from "./components/GoogleMap";
import SaveRouteModal from "./components/SaveRouteModal";
import RouteOverlay from "./components/RouteOverlay";
import AIRouteOptimizer from "./components/AIRouteOptimizer";
import LoginModal from "./components/LoginModal";
import UserProfile from "./components/UserProfile";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRouteStorage } from "./hooks/useRouteStorage";
import { RunningRoute } from "./lib/supabase";
import { RoutePoint } from "./hooks/useRunningRoute";
import "./App.css";

// Material-UI テーマ設定
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
  },
});

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [previousUser, setPreviousUser] = useState<typeof user>(null);
  const { position, error, loading } = useGeolocation();
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
  const [allRoutes, setAllRoutes] = useState<RunningRoute[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<RunningRoute[]>([]);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showAIOptimizer, setShowAIOptimizer] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

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
    padding: "8px 16px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "normal",
    boxShadow: "none",
    color: "white",
    fontSize: "14px",
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

  // マップをルートに合わせてフィット
  const fitMapToRoute = (routePoints: RoutePoint[]) => {
    if (!mapRef.current || routePoints.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    routePoints.forEach((point) => {
      bounds.extend(new google.maps.LatLng(point.lat, point.lng));
    });

    // 適切な余白を持ってフィット
    mapRef.current.fitBounds(bounds, {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    });
  };

  // マップの準備完了コールバック
  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  // 地図クリック処理：手動モードまたは編集モード
  const handleMapClick = (lat: number, lng: number) => {
    console.log("handleMapClick called at:", lat, lng, "isDragging:", isDragging);

    // ドラッグ中またはドラッグ直後はクリックを無視
    if (isDragging) {
      console.log("Map click ignored - dragging in progress");
      return;
    }

    if (isManualMode) {
      // 手動モード：クリックでポイント追加
      const manualPosition = {
        lat,
        lng,
        accuracy: 5, // 高精度設定
        timestamp: Date.now(),
      };
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

  // 末尾のピンを削除する機能
  const handleRemoveLastPin = () => {
    if (isEditMode) {
      // 編集モード：editableRouteから末尾を削除
      if (editableRoute.length > 0) {
        setEditableRoute((prev) => prev.slice(0, -1));
      }
    } else if (isManualMode) {
      // 手動モード：editableRouteから末尾を削除
      if (editableRoute.length > 0) {
        setEditableRoute((prev) => prev.slice(0, -1));
      }
    }
  };

  // ルート保存処理
  const handleSaveRoute = async (name: string, description?: string) => {
    try {
      // 手動作成モード時はeditableRouteを使用
      const routeToSave = editableRoute;

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

      const distance = isManualMode ? calculateTotalDistance(editableRoute) : 0;
      const duration = isManualMode ? 0 : 0; // 手動作成時は時間なし

      await saveRoute(name, description, routeToSave, distance, duration);

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
      } catch (error) {
        console.error("ルート一覧更新エラー:", error);
      }

      // 保存成功のトースト表示
      showToast("ルートが正常に保存されました！", "success");

      // 保存成功後はルートをクリア
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

    // 既に選択されているルートの場合は、マップビューを移動
    if (selectedRouteId === route.id) {
      fitMapToRoute(routePoints);
      return;
    }

    setSelectedRouteId(route.id); // 選択されたルートIDを設定
    setIsEditMode(false); // 編集モード無効
    setIsManualMode(false); // 新規手動作成モードもキャンセル

    // 選択されたルートデータは常に保持（編集のため）
    setLoadedRoute(routePoints);
    setEditableRoute([...routePoints]);
  };

  // ルートの表示/非表示を切り替える
  const toggleRouteVisibility = (routeId: string) => {
    setVisibleRoutes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  };

  // 全ルートの表示/非表示を切り替える
  const toggleAllRoutesVisibility = () => {
    if (visibleRoutes.size === savedRoutes.length && savedRoutes.length > 0) {
      // 全て表示中の場合は全て非表示に
      setVisibleRoutes(new Set());
    } else {
      // 一部または全て非表示の場合は全て表示に
      setVisibleRoutes(new Set(savedRoutes.map((route) => route.id)));
    }
  };

  // ユーザー変更を監視（ログイン時のルート移行検知）
  useEffect(() => {
    if (user && !previousUser) {
      // 新規ログイン時
      const checkForMigratedRoutes = async () => {
        try {
          // 少し待ってからルート一覧を再読み込み（移行処理完了を待つ）
          setTimeout(async () => {
            const routes = await loadUserRoutes();
            setSavedRoutes(routes);
            setAllRoutes(routes);
          }, 1000);
        } catch (error) {
          console.error("ルート一覧の取得に失敗しました:", error);
        }
      };

      checkForMigratedRoutes();
    }

    setPreviousUser(user);
  }, [user, previousUser, loadUserRoutes]);

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
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute([]);

    // 手動作成モードで記録開始
    setIsManualMode(true);
  };

  // AIルート処理
  const handleAIGeneratedRoute = (route: RoutePoint[]) => {
    // 現在の状態をクリア
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);

    // AIで生成されたルートを編集可能な状態で設定
    setEditableRoute(route);
    setIsManualMode(true); // 手動モードとして扱い、編集・保存可能にする

    showToast("AIルートが生成されました！必要に応じて編集して保存してください。", "success");
  };

  // ルートコピー処理
  const handleRouteCopy = (route: RunningRoute) => {
    // GeoJSON LineStringをRoutePointに変換
    const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
      lat: coord[1],
      lng: coord[0],
      timestamp: Date.now() + index * 1000, // 仮のタイムスタンプ
      accuracy: route.elevation_data?.[index] || 5,
    }));

    // 現在の状態をクリア
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);

    // コピーしたルートを編集可能な状態で設定
    setEditableRoute(routePoints);
    setIsManualMode(true); // 手動モードとして扱い、編集・保存可能にする

    showToast(`「${route.name}」をコピーしました！編集して保存してください。`, "success");
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
      }, 100);
    } else if (loadedRoute.length > 0) {
      // 手動作成モードを終了
      setIsManualMode(false);

      // 現在表示中のルートを編集対象とする
      setEditableRoute([...loadedRoute]);
      setIsEditMode(true);
      // 編集時は個別表示に切り替え
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

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
      } catch (error) {
        console.error("ルート一覧更新エラー:", error);
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
      if (isEditMode || isManualMode) {
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
    [isEditMode, isManualMode]
  );

  // ポイント削除処理
  const handlePointDelete = React.useCallback(
    (index: number) => {
      if (isEditMode || isManualMode) {
        setEditableRoute((prevRoute) => prevRoute.filter((_, i) => i !== index));
      }
    },
    [isEditMode, isManualMode]
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
      setSavedRoutes((prevRoutes) => prevRoutes.filter((route) => route.id !== routeId));

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
      if (!isEditMode && !isManualMode) return;

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
      const targetRoute = isEditMode ? editableRoute : editableRoute;

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
    [isEditMode, isManualMode, editableRoute, isDragging]
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

  // 認証ローディング中
  if (authLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "16px" }}>🏃‍♂️</div>
          <div style={{ fontSize: "18px", color: "#6c757d" }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          width: "100%",
          flexDirection: "row",
          backgroundColor: "#282c34",
          color: "white",
          fontSize: "16px",
        }}
      >
        <div
          style={{
            textAlign: "left",
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
          }}
          onClick={() => window.location.reload()}
        >
          <DirectionsRun sx={{ fontSize: "2rem", color: "#4caf50" }} />
          <div>
            <h1
              style={{
                margin: "5px 0",
                fontSize: "1.2em",
                textAlign: "left",
                fontFamily: "Poppins, sans-serif",
                fontWeight: "600",
              }}
            >
              ランメモ
            </h1>
          </div>
        </div>

        {/* ユーザープロフィール/ログインボタン */}
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          {user ? (
            <UserProfile />
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: "6px 12px",
                backgroundColor: "transparent",
                color: "rgba(255, 255, 255, 0.8)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "normal",
                boxShadow: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.2s ease, color 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
              }}
            >
              <Person sx={{ fontSize: "18px" }} />
              ログイン
            </button>
          )}
        </div>
      </header>

      <div className="app-main">
        {/* メインコンテンツ */}
        <div className="main-content" style={{ width: "100%" }}>
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
                  <button
                    onClick={handleRemoveLastPin}
                    style={getButtonStyle("255, 193, 7")}
                    disabled={editableRoute.length === 0}
                  >
                    🗑️ 末尾削除
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
              {isManualMode && (
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
                      setEditableRoute([]);
                      setIsManualMode(false); // 手動作成モード終了
                    }}
                    style={getButtonStyle("108, 117, 125")}
                  >
                    ❌ キャンセル
                  </button>
                  <button
                    onClick={handleRemoveLastPin}
                    style={getButtonStyle("255, 193, 7")}
                    disabled={editableRoute.length === 0}
                  >
                    🗑️ 末尾削除
                  </button>
                </>
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

            {/* Google Maps */}
            {apiKey ? (
              <GoogleMap
                apiKey={apiKey}
                center={mapCenter}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                onMapReady={handleMapReady}
                userPosition={userPosition}
                routePoints={
                  isEditMode
                    ? editableRoute
                    : isManualMode && editableRoute.length > 0
                    ? editableRoute
                    : visibleRoutes.size > 0
                    ? []
                    : loadedRoute
                }
                onMapClick={handleMapClick}
                isDemoMode={isManualMode}
                isEditMode={isEditMode}
                onPointDrag={handlePointDrag}
                onPointDelete={handlePointDelete}
                onRouteLineClick={handleRouteLineClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                allRoutes={allRoutes}
                visibleRoutes={visibleRoutes}
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
              onToggleAllRoutes={toggleAllRoutesVisibility}
              onStartManualCreation={handleStartManualCreation}
              onStartAIGeneration={() => setShowAIOptimizer(true)}
              onStartRouteCopy={handleRouteCopy}
              visibleRoutes={visibleRoutes}
              onToggleRouteVisibility={toggleRouteVisibility}
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
        distance={0}
        duration={0}
        isLoading={isSaving}
      />

      {/* AIルート最適化モーダル */}
      <AIRouteOptimizer
        isOpen={showAIOptimizer}
        onClose={() => setShowAIOptimizer(false)}
        onGenerateRoute={handleAIGeneratedRoute}
        currentPosition={userPosition}
      />

      {/* ログインモーダル */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

// AuthProviderでラップしたメインのAppコンポーネント
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
