import React, { useEffect, useState, useRef } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  DirectionsRun,
  Person,
  SaveAlt,
  Cancel,
  Backspace,
  Undo,
  AddCircleOutline,
  Polyline,
  RemoveCircleOutline,
  ChangeCircle,
  Help,
} from "@mui/icons-material";
import GoogleMap from "./components/GoogleMap";
import SaveRouteModal from "./components/SaveRouteModal";
import EditRouteModal from "./components/EditRouteModal";
import RouteOverlay from "./components/RouteOverlay";
import AIRouteOptimizer from "./components/AIRouteOptimizer";
import LoginModal from "./components/LoginModal";
import UserProfile from "./components/UserProfile";
import CurrentLocationButton from "./components/CurrentLocationButton";
import HelpModal from "./components/HelpModal";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRouteStorage } from "./hooks/useRouteStorage";
import { RunningRoute, updateRoutesOrder, updateRouteVisibility } from "./lib/supabase";
import { RoutePoint } from "./hooks/useRunningRoute";
import "./App.css";

// OS判定
const detectOS = () => {
  let ret;
  if (
    navigator.userAgent.indexOf("iPhone") > 0 ||
    navigator.userAgent.indexOf("iPad") > 0 ||
    navigator.userAgent.indexOf("iPod") > 0
  ) {
    ret = "iphone";
  } else if (navigator.userAgent.indexOf("Android") > 0) {
    ret = "android";
  } else {
    ret = "pc";
  }
  return ret;
};

// 端末の傾き補正（Android用）
const compassHeading = (alpha: number, beta: number, gamma: number) => {
  const degtorad = Math.PI / 180; // Degree-to-Radian conversion

  const _x = beta ? beta * degtorad : 0; // beta value
  const _y = gamma ? gamma * degtorad : 0; // gamma value
  const _z = alpha ? alpha * degtorad : 0; // alpha value

  const cY = Math.cos(_y);
  const cZ = Math.cos(_z);
  const sX = Math.sin(_x);
  const sY = Math.sin(_y);
  const sZ = Math.sin(_z);

  // Calculate Vx and Vy components
  const Vx = -cZ * sY - sZ * sX * cY;
  const Vy = -sZ * sY + cZ * sX * cY;

  // Calculate compass heading
  let compassHeadingResult = Math.atan(Vx / Vy);

  // Convert compass heading to use whole unit circle
  if (Vy < 0) {
    compassHeadingResult += Math.PI;
  } else if (Vx < 0) {
    compassHeadingResult += 2 * Math.PI;
  }

  return compassHeadingResult * (180 / Math.PI); // Compass Heading (in degrees)
};

// 端末方位を取得
const getCompassHeading = (): Promise<number> => {
  return new Promise((resolve) => {
    // OS判定
    const os = detectOS();
    let eventType: string;

    if (os === "iphone") {
      eventType = "deviceorientation";
    } else if (os === "android") {
      eventType = "deviceorientationabsolute";
    } else {
      resolve(0);
      return;
    }

    let degrees: number | null = null;

    // ジャイロスコープと地磁気をセンサーから取得
    const orientationHandler = (event: any) => {
      if (os === "iphone") {
        // webkitCompassHeading値を採用（90度補正）
        let heading = event.webkitCompassHeading || event.alpha || 0;
        // iOS でも90度補正（座標系の違いを調整）
        degrees = (heading - 90 + 360) % 360;
      } else {
        // deviceorientationabsoluteイベントのalphaを補正
        let correctedHeading = compassHeading(event.alpha || 0, event.beta || 0, event.gamma || 0);
        // 90度補正（座標系の違いを調整）
        correctedHeading = (correctedHeading - 90 + 360) % 360;
        degrees = correctedHeading;
      }
    };

    // iOS 13+ でのPermission要求（必要な場合）
    const setupEventListener = () => {
      // イベントリスナーを登録
      window.addEventListener(eventType, orientationHandler, true);

      let retry = 1;

      // 端末方位を取得できたかを検知
      const degreesInterval = setInterval(() => {
        // 端末方位を取得できた場合
        if (degrees !== null) {
          // タイマーを停止
          clearInterval(degreesInterval);
          // イベントリスナーを削除
          window.removeEventListener(eventType, orientationHandler, true);
          resolve(degrees);
        }
        // 3回までリトライ
        if (retry >= 3) {
          // タイマーを停止
          clearInterval(degreesInterval);
          // イベントリスナーを削除
          window.removeEventListener(eventType, orientationHandler, true);
          resolve(0);
        }
        retry++;
      }, 100);
    };

    // iOSの場合はPermission要求
    if (
      os === "iphone" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      (DeviceOrientationEvent as any)
        .requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            setupEventListener();
          } else {
            resolve(0);
          }
        })
        .catch(() => {
          resolve(0);
        });
    } else {
      setupEventListener();
    }
  });
};

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
  const [isCreationMode, setIsCreationMode] = useState(false);
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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RunningRoute | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentLocationMarker, setCurrentLocationMarker] = useState<{
    position: { lat: number; lng: number };
    heading: number;
  } | null>(null);
  const [isRouteOverlayExpanded, setIsRouteOverlayExpanded] = useState(false);
  const [routeOverlayHeight, setRouteOverlayHeight] = useState(500);
  // 表示状態を初期化するヘルパー関数
  const initializeVisibility = (routes: RunningRoute[]) => {
    const visibleRouteIds = routes
      .filter(route => route.is_visible !== false) // デフォルトはtrue
      .map(route => route.id);
    setVisibleRoutes(new Set(visibleRouteIds));
  };

  const [editingMode, setEditingMode] = useState<"add" | "addOnRoute" | "delete" | "roundTrip">(
    "add"
  );
  const [undoStack, setUndoStack] = useState<RoutePoint[][]>([]);
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

  // トースト通知表示関数
  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000); // 3秒後に非表示
  };

  // Undoスタックに現在の状態を保存
  const pushToUndoStack = (currentRoute: RoutePoint[]) => {
    setUndoStack(prev => {
      const newStack = [...prev, [...currentRoute]];
      // スタックサイズを制限（最大10回まで）
      return newStack.length > 10 ? newStack.slice(1) : newStack;
    });
  };

  // Undoスタックをクリア
  const clearUndoStack = () => {
    setUndoStack([]);
  };

  // 現在位置を取得して表示
  const handleCurrentLocationClick = async () => {
    if (!navigator.geolocation) {
      showToast("現在位置の取得に対応していません", "error");
      return;
    }

    try {
      // まず高精度で試行、失敗したら低精度で再試行
      let position: GeolocationPosition;
      try {
        console.log("高精度位置取得を試行中...");
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000, // PCでは短めに
            maximumAge: 60000,
          });
        });
        console.log("高精度位置取得成功");
      } catch (highAccuracyError) {
        console.log("高精度位置取得に失敗、低精度で再試行:", highAccuracyError);

        // 低精度で再試行
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 20000, // PCでは長めに
            maximumAge: 600000, // 10分間キャッシュ
          });
        });
        console.log("低精度位置取得成功");
      }

      const { latitude, longitude, accuracy } = position.coords;
      const currentPos = { lat: latitude, lng: longitude };

      console.log("取得した位置情報:", {
        latitude,
        longitude,
        heading: "GPSからは取得不可",
        accuracy: accuracy ? `${Math.round(accuracy)}m` : "不明",
        timestamp: new Date(position.timestamp).toLocaleString(),
      });

      // マップを現在位置に移動（ズーム調整なし）
      if (mapRef.current) {
        mapRef.current.setCenter(currentPos);
      }

      // デバイスの方向を取得（DeviceOrientationEventから）
      let deviceHeading = 0;

      // コンパス方向を取得（モバイルデバイスの場合）
      deviceHeading = await getCompassHeading();

      // 現在位置マーカーを表示
      setCurrentLocationMarker({
        position: currentPos,
        heading: deviceHeading,
      });
    } catch (error) {
      console.error("現在位置の取得に失敗:", error);
      showToast("現在位置の取得に失敗しました", "error");
    }
  };

  // 現在位置マーカーのフェードアウト完了
  const handleCurrentLocationFadeComplete = () => {
    setCurrentLocationMarker(null);
  };

  // ルートオーバーレイの拡張状態をトグル
  const handleToggleRouteOverlayExpanded = () => {
    setIsRouteOverlayExpanded(!isRouteOverlayExpanded);
  };

  // ルートオーバーレイの高さ変更
  const handleRouteOverlayHeightChange = (height: number) => {
    setRouteOverlayHeight(height);
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

    if (isCreationMode) {
      // 手動モード：クリックでポイント追加
      pushToUndoStack(editableRoute); // 追加前の状態を保存
      const manualPosition = {
        lat,
        lng,
        accuracy: 5, // 高精度設定
        timestamp: Date.now(),
      };
      setEditableRoute((prevRoute) => [...prevRoute, manualPosition]);
    } else if (isEditMode) {
      // 編集モード：クリックでピンを追加
      pushToUndoStack(editableRoute); // 追加前の状態を保存
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };
      setEditableRoute((prevRoute) => [...prevRoute, newPoint]);
    }
  };

  // Undo/末尾削除機能
  const handleUndoOrRemoveLastPin = () => {
    if (undoStack.length > 0) {
      // Undoが可能な場合はUndo実行
      const previousState = undoStack[undoStack.length - 1];
      setEditableRoute([...previousState]);
      setUndoStack(prev => prev.slice(0, -1));
    } else {
      // Undoがない場合は末尾ピンを削除（Undoスタックには追加しない）
      if (isEditMode || isCreationMode) {
        if (editableRoute.length > 0) {
          setEditableRoute((prev) => prev.slice(0, -1));
        }
      }
    }
  };

  // 十字マーク位置（マップ中心）でのピン操作
  const handleCrosshairAction = () => {
    if (!mapRef.current) return;

    const center = mapRef.current.getCenter();
    if (!center) return;

    const lat = center.lat();
    const lng = center.lng();

    if (editingMode === "add") {
      // ピン追加
      pushToUndoStack(editableRoute); // 追加前の状態を保存
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };
      setEditableRoute((prevRoute) => [...prevRoute, newPoint]);
    } else if (editingMode === "delete") {
      // 最も近いピンを削除
      if (editableRoute.length > 0) {
        const targetIndex = findClosestPinIndex(lat, lng);
        if (targetIndex !== -1) {
          pushToUndoStack(editableRoute); // 削除前の状態を保存
          setEditableRoute((prev) => prev.filter((_, index) => index !== targetIndex));
        }
      }
    } else if (editingMode === "addOnRoute") {
      // ルート上の最適な位置にピンを挿入
      pushToUndoStack(editableRoute); // 追加前の状態を保存
      if (editableRoute.length >= 2) {
        const insertIndex = findBestInsertIndex(lat, lng);
        const newPoint: RoutePoint = {
          lat,
          lng,
          accuracy: 5,
          timestamp: Date.now(),
        };
        setEditableRoute((prev) => {
          const newRoute = [...prev];
          newRoute.splice(insertIndex, 0, newPoint);
          return newRoute;
        });
      } else {
        // ルートが短い場合は末尾に追加
        const newPoint: RoutePoint = {
          lat,
          lng,
          accuracy: 5,
          timestamp: Date.now(),
        };
        setEditableRoute((prevRoute) => [...prevRoute, newPoint]);
      }
    } else if (editingMode === "roundTrip") {
      // 往復追加モード時のメッセージ
      showToast("ピンをクリックして往復ルートを追加してください", "success");
    }
  };

  // 最も近いピンのインデックスを取得
  const findClosestPinIndex = (lat: number, lng: number): number => {
    let closestIndex = -1;
    let minDistance = Infinity;

    editableRoute.forEach((point, index) => {
      const distance = Math.sqrt(Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  // ルート上の最適な挿入位置を取得
  const findBestInsertIndex = (lat: number, lng: number): number => {
    if (editableRoute.length < 2) return editableRoute.length;

    let bestIndex = editableRoute.length;
    let minDistance = Infinity;

    for (let i = 0; i < editableRoute.length - 1; i++) {
      const point1 = editableRoute[i];
      const point2 = editableRoute[i + 1];

      // 線分への距離を計算（簡易版）
      const distance = distanceToLineSegment(lat, lng, point1, point2);
      if (distance < minDistance) {
        minDistance = distance;
        bestIndex = i + 1;
      }
    }

    return bestIndex;
  };

  // 点から線分への距離を計算
  const distanceToLineSegment = (
    pointLat: number,
    pointLng: number,
    line1: RoutePoint,
    line2: RoutePoint
  ): number => {
    const A = pointLat - line1.lat;
    const B = pointLng - line1.lng;
    const C = line2.lat - line1.lat;
    const D = line2.lng - line1.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = line1.lat;
      yy = line1.lng;
    } else if (param > 1) {
      xx = line2.lat;
      yy = line2.lng;
    } else {
      xx = line1.lat + param * C;
      yy = line1.lng + param * D;
    }

    const dx = pointLat - xx;
    const dy = pointLng - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 距離計算関数を外部に分離
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

  // ルート保存処理
  const handleSaveRoute = async (name: string, description?: string, customDuration?: number) => {
    try {
      // 手動作成モード時はeditableRouteを使用
      const routeToSave = editableRoute;

      const distance = isCreationMode ? calculateTotalDistance(editableRoute) : 0;
      // customDurationが渡された場合は手動入力された時間を使用、それ以外は0
      const duration = customDuration !== undefined ? customDuration : isCreationMode ? 0 : 0;

      await saveRoute(name, description, routeToSave, distance, duration);

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
        setAllRoutes(updatedRoutes);
        initializeVisibility(updatedRoutes);
      } catch (error) {
        console.error("ルート一覧更新エラー:", error);
      }

      // 保存成功のトースト表示
      showToast("ルートが正常に保存されました！", "success");

      // 保存成功後はルートをクリア
      setLoadedRoute([]);
      setEditableRoute([]);
      setIsCreationMode(false); // 手動作成モード終了
    } catch (error) {
      // エラーはSaveRouteModalで表示される
      throw error;
    }
  };

  // ルート選択処理（onSelectRoute）
  const handleSelectRoute = React.useCallback(
    (route: RunningRoute) => {
      // GeoJSON LineStringをRoutePointに変換
      const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
        lat: coord[1],
        lng: coord[0],
        timestamp: Date.now() + index * 1000, // 仮のタイムスタンプ
        accuracy: route.elevation_data?.[index] || 5,
      }));

      // 選択されたルートが現在選択中のルートと同じ場合：編集モードと通常表示モードを交互に切り替え
      if (selectedRouteId === route.id) {
        if (isEditMode) {
          // 現在編集モードの場合：編集モードを終了して通常表示モードに移行
          setIsEditMode(false);
          setEditableRoute([]);
          // selectedRouteIdとloadedRouteは保持してルートを通常表示モードで表示
        } else {
          // 現在通常表示モードの場合：編集モードに切り替え
          setIsEditMode(true);
          setEditableRoute([...loadedRoute]); // loadedRouteの内容をeditableRouteにコピー
          clearUndoStack(); // 編集開始時にUndoスタックをクリア
          // 編集モードに入る時のみマップビューを調整
          fitMapToRoute(loadedRoute);
        }
        setIsCreationMode(false);
        return;
      }

      // 選択されたルートが異なる場合：そのルートを通常表示モードで表示
      setSelectedRouteId(route.id);
      setIsEditMode(false); // 通常表示モード
      setIsCreationMode(false); // 新規手動作成モードはキャンセル
      setLoadedRoute(routePoints);
      setEditableRoute([]); // 編集モードではないため空にする

      // 通常表示モードではマップ移動しない（現在のビューを維持）
    },
    [selectedRouteId, isEditMode, loadedRoute]
  );

  // ルートの表示/非表示を切り替える
  const toggleRouteVisibility = async (routeId: string) => {
    const isCurrentlyVisible = visibleRoutes.has(routeId);
    const newVisibility = !isCurrentlyVisible;
    
    try {
      // データベースを先に更新
      await updateRouteVisibility(routeId, newVisibility);
      
      // 成功したらローカル状態を更新
      setVisibleRoutes((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyVisible) {
          newSet.delete(routeId);
        } else {
          newSet.add(routeId);
        }
        return newSet;
      });
      
      // allRoutesとsavedRoutesの表示状態も更新
      setAllRoutes(prev => prev.map(route => 
        route.id === routeId ? { ...route, is_visible: newVisibility } : route
      ));
      setSavedRoutes(prev => prev.map(route => 
        route.id === routeId ? { ...route, is_visible: newVisibility } : route
      ));
    } catch (error) {
      console.error("ルート表示状態の更新に失敗しました:", error);
      showToast("表示状態の更新に失敗しました", "error");
    }
  };

  // 全ルートの表示/非表示を切り替える
  const toggleAllRoutesVisibility = async () => {
    const allVisible = visibleRoutes.size === savedRoutes.length && savedRoutes.length > 0;
    const newVisibility = !allVisible;
    
    try {
      // 全ルートの表示状態をデータベースで更新
      const updatePromises = savedRoutes.map(route => 
        updateRouteVisibility(route.id, newVisibility)
      );
      await Promise.all(updatePromises);
      
      // 成功したらローカル状態を更新
      if (allVisible) {
        // 全て表示中の場合は全て非表示に
        setVisibleRoutes(new Set());
      } else {
        // 一部または全て非表示の場合は全て表示に
        setVisibleRoutes(new Set(savedRoutes.map((route) => route.id)));
      }
      
      // allRoutesとsavedRoutesの表示状態も更新
      setAllRoutes(prev => prev.map(route => ({ ...route, is_visible: newVisibility })));
      setSavedRoutes(prev => prev.map(route => ({ ...route, is_visible: newVisibility })));
    } catch (error) {
      console.error("一括表示状態の更新に失敗しました:", error);
      showToast("一括表示状態の更新に失敗しました", "error");
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
            
            // データベースから読み込んだ表示状態を設定
            initializeVisibility(routes);
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
        setAllRoutes(routes);
        
        // データベースから読み込んだ表示状態を設定
        initializeVisibility(routes);
      } catch (error) {
        console.error("初期ルート読み込みエラー:", error);
      }
    };

    loadInitialRoutes();
  }, []);

  // キーボードナビゲーション（左右矢印キーでルート選択）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 編集・作成モード時はキーボードナビゲーションを無効化
      if (isEditMode || isCreationMode || savedRoutes.length === 0) {
        return;
      }

      // 入力フィールドやモーダルにフォーカスがある場合は無効化
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();

        const currentIndex = selectedRouteId
          ? savedRoutes.findIndex((route) => route.id === selectedRouteId)
          : -1;

        let nextIndex;
        if (e.key === "ArrowLeft") {
          // 左矢印：前のルートへ
          nextIndex = currentIndex <= 0 ? savedRoutes.length - 1 : currentIndex - 1;
        } else {
          // 右矢印：次のルートへ
          nextIndex = currentIndex >= savedRoutes.length - 1 ? 0 : currentIndex + 1;
        }

        const nextRoute = savedRoutes[nextIndex];
        if (nextRoute) {
          handleSelectRoute(nextRoute);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [savedRoutes, selectedRouteId, isEditMode, isCreationMode, handleSelectRoute]);

  // ルート並び替え処理
  const handleReorderRoutes = async (newRoutes: RunningRoute[]) => {
    try {
      // 新しい順序でルートを更新
      setSavedRoutes(newRoutes);
      setAllRoutes(newRoutes);

      // DBに並び替え順序を保存
      const routeIds = newRoutes.map((route) => route.id);
      await updateRoutesOrder(routeIds);
    } catch (error) {
      console.error("ルート並び替えエラー:", error);
      showToast("ルートの並び替えに失敗しました", "error");

      // エラー時は元の順序に戻す
      try {
        const routes = await loadUserRoutes();
        setSavedRoutes(routes);
        setAllRoutes(routes);
        initializeVisibility(routes);
      } catch (reloadError) {
        console.error("ルート再読み込みエラー:", reloadError);
      }
    }
  };

  // 手動作成開始
  const handleStartManualCreation = () => {
    // 現在の状態をクリア
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute([]);
    clearUndoStack(); // Undoスタックをクリア

    // 手動作成モードで記録開始
    setIsCreationMode(true);
  };

  // AIルート処理
  const handleAIGeneratedRoute = (route: RoutePoint[]) => {
    // 現在の状態をクリア
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);

    // AIで生成されたルートを編集可能な状態で設定
    setEditableRoute(route);
    setIsCreationMode(true); // 手動モードとして扱い、編集・保存可能にする

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
    setIsCreationMode(true); // 手動モードとして扱い、編集・保存可能にする

    showToast(`「${route.name}」をコピーしました！編集して保存してください。`, "success");
  };

  // ルート編集処理（モーダル表示）
  const handleEditRoute = async (
    routeId: string,
    updates: { name?: string; description?: string; duration?: number }
  ) => {
    try {
      // updateRunningRouteを直接インポートして使用
      const { updateRunningRoute } = await import("./lib/supabase");

      // 更新データを準備
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.duration !== undefined) updateData.duration = updates.duration; // 既に秒単位で渡される

      // Supabaseでルートを更新
      await updateRunningRoute(routeId, updateData);

      // オーバーレイのルート一覧を更新
      const updatedRoutes = await loadUserRoutes();
      setSavedRoutes(updatedRoutes);
      setAllRoutes(updatedRoutes);
      initializeVisibility(updatedRoutes);

      showToast("ルートが正常に更新されました！", "success");
    } catch (error) {
      console.error("ルート更新エラー:", error);
      showToast("ルートの更新に失敗しました。もう一度お試しください。", "error");
      throw error;
    }
  };

  // EditRouteModalを開く
  const handleOpenEditModal = (route: RunningRoute) => {
    setEditingRoute(route);
    setShowEditModal(true);
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
      const newDistance = calculateTotalDistance(editableRoute);

      // 既存ルートを更新（時間は更新しない）
      await updateRoute(selectedRouteId, editableRoute, newDistance);

      // 成功後に状態を更新
      setLoadedRoute([...editableRoute]);
      setIsEditMode(false);
      setEditableRoute([]);

      // オーバーレイのルート一覧を更新
      try {
        const updatedRoutes = await loadUserRoutes();
        setSavedRoutes(updatedRoutes);
        setAllRoutes(updatedRoutes);
        initializeVisibility(updatedRoutes);
      } catch (error) {
        console.error("ルート一覧更新エラー:", error);
      }

      showToast("ルートが正常に更新されました！", "success");
    } catch (error) {
      console.error("ルート更新エラー:", error);
      showToast("ルートの更新に失敗しました。もう一度お試しください。", "error");
    }
  };

  // ドラッグ開始状態を管理
  const dragStartStateRef = useRef<RoutePoint[] | null>(null);

  // ドラッグ開始時の状態を保存
  const handleDragStartWithUndo = React.useCallback(() => {
    dragStartStateRef.current = [...editableRoute];
    console.log("App handleDragStart called");
    setIsDragging(true);
  }, [editableRoute]);

  // ドラッグ終了時にUndoスタックに保存
  const handleDragEndWithUndo = React.useCallback(() => {
    if (dragStartStateRef.current) {
      pushToUndoStack(dragStartStateRef.current);
      dragStartStateRef.current = null;
    }
    console.log("App handleDragEnd called");
    // 短時間の遅延後にドラッグ状態をリセット
    setTimeout(() => {
      console.log("App drag state reset after timeout");
      setIsDragging(false);
    }, 300); // 300msに調整
  }, [pushToUndoStack]);

  // ポイントドラッグ処理（ちらつき防止のため参照を保持）
  const handlePointDrag = React.useCallback(
    (index: number, lat: number, lng: number) => {
      if (isEditMode || isCreationMode) {
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
    [isEditMode, isCreationMode]
  );

  // ポイント削除処理
  const handlePointDelete = React.useCallback(
    (index: number) => {
      if (isEditMode || isCreationMode) {
        pushToUndoStack(editableRoute); // 削除前の状態を保存
        setEditableRoute((prevRoute) => prevRoute.filter((_, i) => i !== index));
      }
    },
    [isEditMode, isCreationMode, editableRoute, pushToUndoStack]
  );

  // 往復ルート追加処理
  const handleAddRoundTrip = React.useCallback(
    (index: number) => {
      if (!isEditMode && !isCreationMode) return;

      pushToUndoStack(editableRoute); // 追加前の状態を保存

      setEditableRoute((prevRoute) => {
        const newRoute = [...prevRoute];

        // 末尾ピンからクリックされたピンまでのルートを追加
        if (index < newRoute.length - 1) {
          // クリックされたピンが末尾でない場合
          // 末尾からクリックピンまでの経路を作成（逆順）
          const fromEndToClick = newRoute.slice(index, newRoute.length).reverse();

          // 既存ルート + 末尾からクリックピンまでの経路（末尾ピンを除く）
          const extendedRoute = [...newRoute, ...fromEndToClick.slice(1)];

          return extendedRoute;
        }

        // クリックされたピンが既に末尾の場合は何もしない
        return newRoute;
      });

      showToast(`末尾からピン${index + 1}までのルートを追加しました`, "success");
    },
    [isEditMode, isCreationMode, editableRoute, pushToUndoStack]
  );


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
      setAllRoutes((prevRoutes) => prevRoutes.filter((route) => route.id !== routeId));
      
      // 削除されたルートを表示状態からも除去
      setVisibleRoutes((prevVisible) => {
        const newVisible = new Set(prevVisible);
        newVisible.delete(routeId);
        return newVisible;
      });

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
      if (!isEditMode && !isCreationMode) return;

      // ドラッグ中はピン挿入を無効化
      if (isDragging) {
        console.log("Route line click ignored - dragging in progress");
        return;
      }

      // ルート線クリック時のピン追加前にUndoスタックに保存
      pushToUndoStack(editableRoute);

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
    [isEditMode, isCreationMode, editableRoute, isDragging, pushToUndoStack]
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
          <DirectionsRun style={{ fontSize: "64px", color: "#1976d2", marginBottom: "16px" }} />
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

        {/* ヘルプボタンとユーザープロフィール/ログインボタン */}
        <div style={{ textAlign: "right", flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px" }}>
          {/* ヘルプボタン */}
          <Tooltip title="操作方法ガイド">
            <IconButton
              onClick={() => setShowHelpModal(true)}
              sx={{
                color: "rgba(255, 255, 255, 0.8)",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "white",
                },
              }}
            >
              <Help />
            </IconButton>
          </Tooltip>
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
              {/* 編集時のボタンはRouteOverlayに移動したため非表示 */}

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
            </div>

            {/* Google Maps */}
            {apiKey ? (
              <div style={{ position: "relative", height: "100%", width: "100%" }}>
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
                      : isCreationMode && editableRoute.length > 0
                      ? editableRoute
                      : visibleRoutes.size > 0
                      ? []
                      : loadedRoute
                  }
                  onMapClick={handleMapClick}
                  isCreationMode={isCreationMode}
                  isEditMode={isEditMode}
                  onPointDrag={handlePointDrag}
                  onPointDelete={handlePointDelete}
                  onPointClick={editingMode === "roundTrip" ? handleAddRoundTrip : undefined}
                  onRouteLineClick={handleRouteLineClick}
                  onDragStart={handleDragStartWithUndo}
                  onDragEnd={handleDragEndWithUndo}
                  allRoutes={allRoutes}
                  visibleRoutes={visibleRoutes}
                  selectedRouteId={selectedRouteId}
                  onRouteSelect={handleSelectRoute}
                  currentLocationMarker={currentLocationMarker}
                  onCurrentLocationFadeComplete={handleCurrentLocationFadeComplete}
                  onPointDoubleClick={handleAddRoundTrip}
                />
                {/* 現在位置ボタン */}
                <CurrentLocationButton
                  onLocationClick={handleCurrentLocationClick}
                  disabled={loading}
                />
              </div>
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

            {/* 地図中央の十字マーク（編集・作成時のみ表示） */}
            {(isCreationMode || isEditMode) && (
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1000,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    position: "relative",
                    "&::before, &::after": {
                      content: '""',
                      position: "absolute",
                      backgroundColor: "rgba(76, 175, 80, 0.8)",
                      borderRadius: "2px",
                      boxShadow: "0 0 8px rgba(0, 0, 0, 0.5)",
                    },
                    "&::before": {
                      width: "3px",
                      height: "30px",
                      left: "50%",
                      top: 0,
                      transform: "translateX(-50%)",
                    },
                    "&::after": {
                      width: "30px",
                      height: "3px",
                      top: "50%",
                      left: 0,
                      transform: "translateY(-50%)",
                    },
                  }}
                />
                {/* 中央の小さな円 */}
                <Box
                  sx={{
                    position: "absolute",
                    width: 6,
                    height: 6,
                    backgroundColor: "rgba(76, 175, 80, 0.9)",
                    borderRadius: "50%",
                    border: "2px solid white",
                    boxShadow: "0 0 6px rgba(0, 0, 0, 0.5)",
                  }}
                />
              </Box>
            )}

            {/* 編集・作成時のアクションボタン領域 */}
            {(isCreationMode || isEditMode) && (
              <Box
                sx={{
                  position: "absolute",
                  bottom:
                    isCreationMode || isEditMode
                      ? 40
                      : isRouteOverlayExpanded
                      ? routeOverlayHeight + 40
                      : 220,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 1001,
                  backgroundColor: "rgba(255, 255, 255, 0.4)",
                  borderRadius: 4,
                  pb: 1,
                  px: 1.5,
                  boxShadow: 4,
                  backdropFilter: "blur(12px)",
                  display: "flex",
                  gap: 1.8,
                  alignItems: "flex-end",
                  height: 70,
                  overflow: "visible",
                }}
              >
                {/* 1. 保存ボタン */}
                <Tooltip title="保存">
                  <IconButton
                    onClick={() => {
                      if (isEditMode) {
                        applyEdit();
                      } else {
                        setShowSaveModal(true);
                      }
                    }}
                    sx={{
                      backgroundColor: "rgba(33, 150, 243, 0.8)",
                      color: "white",
                      width: 56,
                      height: 56,
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "rgba(33, 150, 243, 1)",
                      },
                    }}
                  >
                    <SaveAlt fontSize="large" />
                  </IconButton>
                </Tooltip>

                {/* 2. モード切り替えボタン */}
                <Tooltip title="編集モード切り替え">
                  <IconButton
                    onClick={() => {
                      if (editingMode === "add") {
                        setEditingMode("addOnRoute");
                      } else if (editingMode === "addOnRoute") {
                        setEditingMode("delete");
                      } else if (editingMode === "delete") {
                        setEditingMode("roundTrip");
                      } else {
                        setEditingMode("add");
                      }
                    }}
                    sx={{
                      backgroundColor: "rgba(76, 175, 80, 0.8)",
                      color: "white",
                      width: 56,
                      height: 56,
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "rgba(76, 175, 80, 1)",
                      },
                    }}
                  >
                    <ChangeCircle fontSize="large" />
                  </IconButton>
                </Tooltip>

                {/* 3. 現在のモードに応じたアクションボタン（最大サイズ） */}
                {editingMode === "add" && (
                  <Tooltip title="ピンを追加">
                    <IconButton
                      onClick={handleCrosshairAction}
                      sx={{
                        backgroundColor: "rgba(76, 175, 80, 0.9)",
                        color: "white",
                        width: 80,
                        height: 80,
                        boxShadow: "none",
                        "&:hover": {
                          backgroundColor: "rgba(76, 175, 80, 1)",
                        },
                      }}
                    >
                      <AddCircleOutline sx={{ fontSize: "3rem" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {editingMode === "addOnRoute" && (
                  <Tooltip title="ルート上に追加">
                    <IconButton
                      onClick={handleCrosshairAction}
                      sx={{
                        backgroundColor: "rgba(76, 175, 80, 0.9)",
                        color: "white",
                        width: 80,
                        height: 80,
                        boxShadow: "none",
                        "&:hover": {
                          backgroundColor: "rgba(76, 175, 80, 1)",
                        },
                      }}
                    >
                      <Polyline sx={{ fontSize: "3rem" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {editingMode === "delete" && (
                  <Tooltip title="ピンを削除">
                    <IconButton
                      onClick={handleCrosshairAction}
                      sx={{
                        backgroundColor: "rgba(76, 175, 80, 0.9)",
                        color: "white",
                        width: 80,
                        height: 80,
                        boxShadow: "none",
                        "&:hover": {
                          backgroundColor: "rgba(76, 175, 80, 1)",
                        },
                      }}
                    >
                      <RemoveCircleOutline sx={{ fontSize: "3rem" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {editingMode === "roundTrip" && (
                  <Tooltip title="ピンをクリックして往復ルート追加">
                    <IconButton
                      onClick={handleCrosshairAction}
                      sx={{
                        backgroundColor: "rgba(156, 39, 176, 0.9)",
                        color: "white",
                        width: 80,
                        height: 80,
                        boxShadow: "none",
                        "&:hover": {
                          backgroundColor: "rgba(156, 39, 176, 1)",
                        },
                      }}
                    >
                      <Polyline sx={{ fontSize: "3rem" }} />
                    </IconButton>
                  </Tooltip>
                )}

                {/* 4. Undo/末尾削除ボタン */}
                <Tooltip
                  title={
                    undoStack.length > 0
                      ? "操作を元に戻す"
                      : editableRoute.length === 0
                      ? "操作できません"
                      : "末尾ピン削除"
                  }
                >
                  <IconButton
                    onClick={
                      undoStack.length > 0 || editableRoute.length > 0
                        ? handleUndoOrRemoveLastPin
                        : undefined
                    }
                    sx={{
                      backgroundColor:
                        undoStack.length > 0 || editableRoute.length > 0
                          ? "rgba(255, 152, 0, 0.8)" // Undo時も削除時もオレンジ色
                          : "rgba(255, 152, 0, 0.4)", // 無効時は薄いオレンジ
                      color: "white",
                      opacity: undoStack.length > 0 || editableRoute.length > 0 ? 1 : 0.6,
                      cursor:
                        undoStack.length > 0 || editableRoute.length > 0
                          ? "pointer"
                          : "not-allowed",
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor:
                          undoStack.length > 0 || editableRoute.length > 0
                            ? "rgba(255, 152, 0, 1)"
                            : "rgba(255, 152, 0, 0.4)",
                      },
                      width: 56,
                      height: 56,
                    }}
                  >
                    {undoStack.length > 0 ? (
                      <Undo fontSize="large" />
                    ) : (
                      <Backspace fontSize="large" />
                    )}
                  </IconButton>
                </Tooltip>

                {/* 5. キャンセルボタン */}
                <Tooltip title="キャンセル">
                  <IconButton
                    onClick={() => {
                      if (isEditMode) {
                        stopEditMode();
                      } else {
                        setIsCreationMode(false);
                        setEditableRoute([]);
                        setSelectedRouteId(undefined);
                      }
                    }}
                    sx={{
                      backgroundColor: "rgba(244, 67, 54, 0.8)",
                      color: "white",
                      width: 56,
                      height: 56,
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "rgba(244, 67, 54, 1)",
                      },
                    }}
                  >
                    <Cancel fontSize="large" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            {/* ルートオーバーレイ（編集・作成時は非表示） */}
            {!isCreationMode && !isEditMode && (
              <RouteOverlay
                routes={savedRoutes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={handleSelectRoute}
                onEditRoute={handleOpenEditModal}
                onDeleteRoute={handleRouteDelete}
                onToggleAllRoutes={toggleAllRoutesVisibility}
                onStartManualCreation={handleStartManualCreation}
                onStartAIGeneration={() => setShowAIOptimizer(true)}
                onStartRouteCopy={handleRouteCopy}
                onReorderRoutes={handleReorderRoutes}
                visibleRoutes={visibleRoutes}
                onToggleRouteVisibility={toggleRouteVisibility}
                isExpanded={isRouteOverlayExpanded}
                onToggleExpanded={handleToggleRouteOverlayExpanded}
                overlayHeight={routeOverlayHeight}
                onHeightChange={handleRouteOverlayHeightChange}
                isCreationMode={isCreationMode}
                isEditMode={isEditMode}
              />
            )}
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
        distance={isCreationMode ? calculateTotalDistance(editableRoute) : 0}
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

      {/* ヘルプモーダル */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* ルート編集モーダル */}
      <EditRouteModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRoute(null);
        }}
        onSave={handleEditRoute}
        route={editingRoute}
        isLoading={isSaving}
      />
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
