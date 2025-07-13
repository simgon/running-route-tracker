import React, { useEffect, useState, useRef } from "react";
import GoogleMap from "./map/GoogleMap";
import RouteFormModal from "./modal/RouteFormModal";
import RouteOverlay from "./route/RouteOverlay";
import AIRouteOptimizerModal from "./modal/AIRouteOptimizerModal";
import LoginModal from "./modal/LoginModal";
import AppHeader from "./common/AppHeader";
import CurrentLocationButton from "./map/CurrentLocationButton";
import HelpModal from "./modal/HelpModal";
import RouteCreationControls, { EditingMode } from "./route/RouteCreationControls";
import CrosshairOverlay from "./map/CrosshairOverlay";
import ConfirmDialog from "./common/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import { useGeolocation } from "./map/useGeolocation";
import { useRouteStorage } from "./route/useRouteStorage";
import { useStreetViewMode } from "./map/useStreetViewMode";
import { useConfirmDialog } from "./common/useConfirmDialog";
import { RunningRoute, updateRoutesOrder, updateRouteVisibility } from "../lib/supabase";
import { RoutePoint } from "../types/route";

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [previousUser, setPreviousUser] = useState<typeof user>(null);
  const { position, error, loading, startTracking, stopTracking, isTracking } = useGeolocation();
  const {
    saveRoute,
    updateRoute,
    deleteRoute,
    loadUserRoutes,
    updateRouteName,
    isLoading: isSaving,
  } = useRouteStorage();
  const { isStreetViewMode, handleStreetViewModeChange } = useStreetViewMode();
  const { dialogState, showConfirm } = useConfirmDialog();

  const [isCreationMode, setIsCreationMode] = useState(false);
  const [showRouteFormModal, setShowRouteFormModal] = useState(false);
  const [routeFormMode, setRouteFormMode] = useState<"save" | "edit">("save");
  const [loadedRoute, setLoadedRoute] = useState<RoutePoint[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableRoute, setEditableRoute] = useState<RoutePoint[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
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
  const [enableRouteAnimation, setEnableRouteAnimation] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RunningRoute | null>(null);
  const [currentLocationMarker, setCurrentLocationMarker] = useState<{
    position: { lat: number; lng: number };
    heading: number;
  } | null>(null);
  const [isRouteOverlayExpanded, setIsRouteOverlayExpanded] = useState(false);
  const [routeOverlayHeight, setRouteOverlayHeight] = useState(500);
  const [editingMode, setEditingMode] = useState<EditingMode>("add");
  const [undoStack, setUndoStack] = useState<RoutePoint[][]>([]);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [hasMovedToCurrentLocation, setHasMovedToCurrentLocation] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);


  // デフォルトの位置（東京駅）
  const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503,
  };

  // 現在位置があれば使用、なければデフォルト（初回のみデフォルト使用）
  const mapCenter = position ? { lat: position.lat, lng: position.lng } : defaultCenter;
  const userPosition = position ? { lat: position.lat, lng: position.lng } : null;

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

  // 表示状態を初期化するヘルパー関数
  const initializeVisibility = (routes: RunningRoute[]) => {
    const visibleRouteIds = routes
      .filter((route) => route.is_visible !== false)
      .map((route) => route.id);
    setVisibleRoutes(new Set(visibleRouteIds));
  };

  // トースト通知表示関数
  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Undoスタックに現在の状態を保存
  const pushToUndoStack = (currentRoute: RoutePoint[]) => {
    setUndoStack((prev) => {
      const newStack = [...prev, [...currentRoute]];
      return newStack.length > 10 ? newStack.slice(1) : newStack;
    });
  };

  // Undoスタックをクリア
  const clearUndoStack = () => {
    setUndoStack([]);
  };

  // デバイスの方角を取得
  const getCompassHeading = (): Promise<number> => {
    return new Promise((resolve) => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);

      if (!isIOS && !isAndroid) {
        resolve(0);
        return;
      }

      const eventType = isIOS ? "deviceorientation" : "deviceorientationabsolute";
      let degrees: number | null = null;

      const orientationHandler = (event: any) => {
        if (isIOS) {
          const heading = event.webkitCompassHeading || event.alpha || 0;
          // iOS用の90度補正
          degrees = (heading - 90 + 360) % 360;
        } else {
          const heading = event.alpha || 0;
          // Android用の90度補正
          degrees = (heading - 90 + 360) % 360;
        }
      };

      const setupEventListener = () => {
        window.addEventListener(eventType, orientationHandler, true);

        setTimeout(() => {
          window.removeEventListener(eventType, orientationHandler, true);
          resolve(degrees || 0);
        }, 1000);
      };

      // iOSの場合はPermission要求
      if (isIOS && typeof (DeviceOrientationEvent as any).requestPermission === "function") {
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

  // 位置情報トラッキングのトグル
  const handleLocationToggle = (enable: boolean) => {
    if (enable) {
      startTracking();
      setHasMovedToCurrentLocation(false); // トラッキング開始時にリセット
      showToast("位置情報トラッキングを開始しました", "success");
    } else {
      stopTracking();
      setCurrentLocationMarker(null); // マーカーを非表示
      showToast("位置情報トラッキングを停止しました", "success");
    }
  };


  // 距離計算関数
  const calculateTotalDistance = (points: RoutePoint[]) => {
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const R = 6371000;
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

  // ルートの中心位置を計算してマップを移動
  const moveMapToRoute = (routePoints: RoutePoint[]) => {
    if (routePoints.length === 0 || !mapRef.current) return;

    if (routePoints.length === 1) {
      // 1つのポイントの場合はそこに移動
      mapRef.current.setCenter({
        lat: routePoints[0].lat,
        lng: routePoints[0].lng,
      });
      mapRef.current.setZoom(16);
    } else {
      // 複数ポイントの場合は境界に合わせる
      const bounds = new google.maps.LatLngBounds();
      routePoints.forEach(point => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  };

  // 地図クリック処理
  const handleMapClick = (lat: number, lng: number) => {
    if (isDragging) return;

    if (isCreationMode || isEditMode) {
      // 編集・作成モード時は常にマップクリックでピン追加
      pushToUndoStack(editableRoute);
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };
      setEditableRoute((prev) => [...prev, newPoint]);
    }
  };

  // ルート線上クリック処理（ピン挿入）
  const handleRouteLineClick = (lat: number, lng: number) => {
    if (isDragging || (!isCreationMode && !isEditMode)) return;

    // ルート上の最適な位置にピンを挿入
    if (editableRoute.length >= 2) {
      pushToUndoStack(editableRoute);
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
      // ルートが短い場合は通常のクリック処理と同じ
      handleMapClick(lat, lng);
    }
  };

  // ピンダブルクリック処理（往復ルート追加）
  const handlePointDoubleClick = (index: number) => {
    if (!isCreationMode && !isEditMode) return;

    // 往復ルート追加：末尾からクリックされたピンまでの往復を追加
    if (editableRoute.length > 1) {
      pushToUndoStack(editableRoute);

      setEditableRoute((prev) => {
        const newRoute = [...prev];

        // 末尾ピンからクリックされたピンまでのルートを逆順で追加
        if (index < newRoute.length - 1) {
          // クリックされたピンが末尾でない場合
          // 末尾からクリックピンまでの経路を作成（逆順）
          const returnRoute: RoutePoint[] = [];
          for (let i = newRoute.length - 2; i >= index; i--) {
            returnRoute.push({
              ...newRoute[i],
              timestamp: Date.now() + returnRoute.length * 1000,
            });
          }

          return [...newRoute, ...returnRoute];
        } else if (index === newRoute.length - 1) {
          // 末尾ピンがクリックされた場合：全体の往復（最初のピンまで戻る）
          const returnRoute: RoutePoint[] = [];
          for (let i = newRoute.length - 2; i >= 0; i--) {
            returnRoute.push({
              ...newRoute[i],
              timestamp: Date.now() + returnRoute.length * 1000,
            });
          }

          return [...newRoute, ...returnRoute];
        }

        return newRoute;
      });

      showToast(`ピン${index + 1}までの往復ルートが追加されました！`, "success");
    } else {
      showToast("往復ルートを追加するには2つ以上のピンが必要です", "error");
    }
  };

  // ルート上の最適な挿入位置を取得
  const findBestInsertIndex = (lat: number, lng: number): number => {
    if (editableRoute.length < 2) return editableRoute.length;

    let bestIndex = editableRoute.length;
    let minDistance = Infinity;

    for (let i = 0; i < editableRoute.length - 1; i++) {
      const point1 = editableRoute[i];
      const point2 = editableRoute[i + 1];

      // 線分への距離を計算
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

  // 十字マーク位置でのピン操作
  const handleCrosshairAction = () => {
    if (!mapRef.current) return;

    const center = mapRef.current.getCenter();
    if (!center) return;

    const lat = center.lat();
    const lng = center.lng();

    if (editingMode === "add") {
      pushToUndoStack(editableRoute);
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now(),
      };
      setEditableRoute((prev) => [...prev, newPoint]);
    } else if (editingMode === "delete") {
      if (editableRoute.length > 0) {
        const targetIndex = findClosestPinIndex(lat, lng);
        if (targetIndex !== -1) {
          pushToUndoStack(editableRoute);
          setEditableRoute((prev) => prev.filter((_, index) => index !== targetIndex));
        }
      }
    } else if (editingMode === "addOnRoute") {
      pushToUndoStack(editableRoute);
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
        const newPoint: RoutePoint = {
          lat,
          lng,
          accuracy: 5,
          timestamp: Date.now(),
        };
        setEditableRoute((prev) => [...prev, newPoint]);
      }
    } else if (editingMode === "roundTrip") {
      // 往復ルート追加：十字マーク（地図中央）に最も近いピンまでの往復
      if (editableRoute.length >= 2) {
        // 十字マーク（地図中央）に最も近いピンを見つける
        const closestPinIndex = findClosestPinIndex(lat, lng);

        if (closestPinIndex !== -1) {
          pushToUndoStack(editableRoute);

          // 最も近いピンまでの往復ルートを追加
          const targetIndex = closestPinIndex;
          const returnRoute: RoutePoint[] = [];

          // 末尾から対象ピンまでの往復を作成
          if (targetIndex < editableRoute.length - 1) {
            // 対象ピンが末尾でない場合：末尾から対象ピンまでの往復
            for (let i = editableRoute.length - 2; i >= targetIndex; i--) {
              returnRoute.push({
                ...editableRoute[i],
                timestamp: Date.now() + returnRoute.length * 1000,
              });
            }
          } else {
            // 対象ピンが末尾の場合：全体の往復
            for (let i = editableRoute.length - 2; i >= 0; i--) {
              returnRoute.push({
                ...editableRoute[i],
                timestamp: Date.now() + returnRoute.length * 1000,
              });
            }
          }

          setEditableRoute((prev) => [...prev, ...returnRoute]);
          showToast(`ピン${targetIndex + 1}までの往復ルートが追加されました！`, "success");
        } else {
          showToast("対象ピンが見つかりません", "error");
        }
      } else {
        showToast("往復ルートを追加するには2つ以上のピンが必要です", "error");
      }
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

  // Undo/末尾削除機能
  const handleUndoOrRemoveLastPin = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setEditableRoute([...previousState]);
      setUndoStack((prev) => prev.slice(0, -1));
    } else {
      if (editableRoute.length > 0) {
        setEditableRoute((prev) => prev.slice(0, -1));
      }
    }
  };

  // ルート保存処理
  const handleSaveRoute = async (name: string, description?: string, customDuration?: number) => {
    try {
      const routeToSave = editableRoute;
      const distance = calculateTotalDistance(editableRoute);
      const duration = customDuration || 0;

      await saveRoute(name, description, routeToSave, distance, duration);

      const updatedRoutes = await loadUserRoutes();
      setSavedRoutes(updatedRoutes);
      initializeVisibility(updatedRoutes);

      showToast("ルートが正常に保存されました！", "success");
      setEditableRoute([]);
      setIsCreationMode(false);
    } catch (error) {
      throw error;
    }
  };

  // ルート選択処理
  const handleSelectRoute = React.useCallback(
    (route: RunningRoute) => {
      const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
        lat: coord[1],
        lng: coord[0],
        timestamp: Date.now() + index * 1000,
        accuracy: route.elevation_data?.[index] || 5,
      }));

      if (selectedRouteId === route.id) {
        if (isEditMode) {
          setIsEditMode(false);
          setEditableRoute([]);
        } else {
          setIsEditMode(true);
          setEditableRoute([...loadedRoute]);
          clearUndoStack();
          // 編集モードに入る時にマップをルート位置に移動
          moveMapToRoute(loadedRoute);
        }
        setIsCreationMode(false);
        return;
      }

      setSelectedRouteId(route.id);
      setIsEditMode(false);
      setIsCreationMode(false);
      setLoadedRoute(routePoints);
      setEditableRoute([]);
    },
    [selectedRouteId, isEditMode, loadedRoute]
  );

  // ルートの表示/非表示を切り替える
  const toggleRouteVisibility = async (routeId: string) => {
    const isCurrentlyVisible = visibleRoutes.has(routeId);
    const newVisibility = !isCurrentlyVisible;

    try {
      await updateRouteVisibility(routeId, newVisibility);

      setVisibleRoutes((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyVisible) {
          newSet.delete(routeId);
        } else {
          newSet.add(routeId);
        }
        return newSet;
      });

      setSavedRoutes((prev) =>
        prev.map((route) =>
          route.id === routeId ? { ...route, is_visible: newVisibility } : route
        )
      );
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
      const updatePromises = savedRoutes.map((route) =>
        updateRouteVisibility(route.id, newVisibility)
      );
      await Promise.all(updatePromises);

      if (allVisible) {
        setVisibleRoutes(new Set());
      } else {
        setVisibleRoutes(new Set(savedRoutes.map((route) => route.id)));
      }

      setSavedRoutes((prev) => prev.map((route) => ({ ...route, is_visible: newVisibility })));
    } catch (error) {
      console.error("一括表示状態の更新に失敗しました:", error);
      showToast("一括表示状態の更新に失敗しました", "error");
    }
  };

  // 手動作成開始
  const handleStartManualCreation = () => {
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute([]);
    clearUndoStack();
    setIsCreationMode(true);
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
      const newDistance = calculateTotalDistance(editableRoute);
      await updateRoute(selectedRouteId, editableRoute, newDistance);

      setLoadedRoute([...editableRoute]);
      setIsEditMode(false);
      setEditableRoute([]);

      const updatedRoutes = await loadUserRoutes();
      setSavedRoutes(updatedRoutes);
      initializeVisibility(updatedRoutes);

      showToast("ルートが正常に更新されました！", "success");
    } catch (error) {
      console.error("ルート更新エラー:", error);
      showToast("ルートの更新に失敗しました。", "error");
    }
  };

  // ルート削除処理
  const handleRouteDelete = async (routeId: string, routeName: string) => {
    const confirmed = await showConfirm({
      title: "ルート削除",
      message: `「${routeName}」を削除しますか？\n\nこの操作は取り消すことができません。`,
      confirmText: "削除",
      cancelText: "キャンセル",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      await deleteRoute(routeId);

      if (selectedRouteId === routeId) {
        setSelectedRouteId(undefined);
        setLoadedRoute([]);
        setEditableRoute([]);
        setIsEditMode(false);
      }

      setSavedRoutes((prev) => prev.filter((route) => route.id !== routeId));
      setVisibleRoutes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(routeId);
        return newSet;
      });

      showToast("ルートが削除されました。", "success");
    } catch (error) {
      console.error("ルート削除エラー:", error);
      showToast("ルートの削除に失敗しました。", "error");
    }
  };

  // ルート編集処理
  const handleEditRoute = async (
    routeId: string,
    updates: { name?: string; description?: string; duration?: number }
  ) => {
    try {
      const { updateRunningRoute } = await import("../lib/supabase");
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.duration !== undefined) updateData.duration = updates.duration;

      await updateRunningRoute(routeId, updateData);

      const updatedRoutes = await loadUserRoutes();
      setSavedRoutes(updatedRoutes);
      initializeVisibility(updatedRoutes);

      showToast("ルートが正常に更新されました！", "success");
    } catch (error) {
      console.error("ルート更新エラー:", error);
      showToast("ルートの更新に失敗しました。", "error");
      throw error;
    }
  };

  // RouteFormModalを編集モードで開く
  const handleOpenEditModal = (route: RunningRoute) => {
    setEditingRoute(route);
    setRouteFormMode("edit");
    setShowRouteFormModal(true);
  };

  // ルート並び替え処理
  const handleReorderRoutes = async (newRoutes: RunningRoute[]) => {
    try {
      setSavedRoutes(newRoutes);
      const routeIds = newRoutes.map((route) => route.id);
      await updateRoutesOrder(routeIds);
    } catch (error) {
      console.error("ルート並び替えエラー:", error);
      showToast("ルートの並び替えに失敗しました", "error");
    }
  };

  // AIルート処理
  const handleAIGeneratedRoute = (route: RoutePoint[]) => {
    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute(route);
    setIsCreationMode(true);
    
    // AIルート生成時にマップをルート位置に移動
    moveMapToRoute(route);
    showToast("AIルートが生成されました！", "success");
  };

  // ルートコピー処理
  const handleRouteCopy = (route: RunningRoute) => {
    const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
      lat: coord[1],
      lng: coord[0],
      timestamp: Date.now() + index * 1000,
      accuracy: route.elevation_data?.[index] || 5,
    }));

    setIsEditMode(false);
    setSelectedRouteId(undefined);
    setLoadedRoute([]);
    setEditableRoute(routePoints);
    setIsCreationMode(true);
    
    // コピー時にマップをルート位置に移動
    moveMapToRoute(routePoints);
    showToast(`「${route.name}」をコピーしました！`, "success");
  };

  // ドラッグ処理
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      setIsDragging(false);
    }, 300);
  };

  // ポイントドラッグ処理
  const handlePointDrag = React.useCallback(
    (index: number, lat: number, lng: number) => {
      if (isEditMode || isCreationMode) {
        setEditableRoute((prev) => {
          const newRoute = [...prev];
          newRoute[index] = { ...newRoute[index], lat, lng };
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
        pushToUndoStack(editableRoute);
        setEditableRoute((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [isEditMode, isCreationMode, editableRoute]
  );

  // アクションボタンのハンドラー関数
  const handleActionSave = () => {
    if (isEditMode) {
      applyEdit();
    } else {
      setRouteFormMode("save");
      setShowRouteFormModal(true);
    }
  };

  const handleModeToggle = () => {
    if (editingMode === "add") {
      setEditingMode("addOnRoute");
    } else if (editingMode === "addOnRoute") {
      setEditingMode("delete");
    } else if (editingMode === "delete") {
      setEditingMode("roundTrip");
    } else {
      setEditingMode("add");
    }
  };

  const handleActionCancel = () => {
    if (isEditMode) {
      stopEditMode();
    } else if (isCreationMode) {
      setIsCreationMode(false);
      setEditableRoute([]);
      clearUndoStack();
    }
  };



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


  // 初期ルート読み込み
  useEffect(() => {
    const loadInitialRoutes = async () => {
      try {
        const routes = await loadUserRoutes();
        setSavedRoutes(routes);
        initializeVisibility(routes);
      } catch (error) {
        console.error("初期ルート読み込みエラー:", error);
      }
    };

    loadInitialRoutes();
  }, []);

  // ユーザー変更を監視
  useEffect(() => {
    if (user && !previousUser) {
      const checkForMigratedRoutes = async () => {
        try {
          setTimeout(async () => {
            const routes = await loadUserRoutes();
            setSavedRoutes(routes);
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


  // 初回位置取得時にマップを現在位置に移動
  useEffect(() => {
    if (position && mapRef.current && !initialLocationSet) {
      console.log('初回位置取得 - マップを現在位置に移動:', position);
      mapRef.current.setCenter({ lat: position.lat, lng: position.lng });
      mapRef.current.setZoom(15);
      setInitialLocationSet(true);
    }
  }, [position, initialLocationSet]);

  // トラッキング中の位置更新でマーカーを更新
  useEffect(() => {
    if (position && isTracking) {
      const now = Date.now();
      
      // 2秒以内の連続更新を制限
      if (now - lastUpdateTime < 2000) {
        return;
      }
      
      setLastUpdateTime(now);
      
      const updateMarkerWithHeading = async () => {
        // コンパス方向を取得
        let heading = position.heading || 0;
        try {
          const compassHeading = await getCompassHeading();
          heading = compassHeading;
        } catch (error) {
          console.log("コンパス取得失敗:", error);
        }

        setCurrentLocationMarker({
          position: { lat: position.lat, lng: position.lng },
          heading: heading,
        });
      };

      updateMarkerWithHeading();
      
      // トラッキング開始後の初回のみマップの中心移動を行う
      if (isTracking && !hasMovedToCurrentLocation && mapRef.current) {
        mapRef.current.setCenter({ lat: position.lat, lng: position.lng });
        setHasMovedToCurrentLocation(true);
      }
    }
  }, [position, isTracking, lastUpdateTime, hasMovedToCurrentLocation]);

  return (
    <div className="App">
      <div className="App-header">
        <AppHeader
          enableRouteAnimation={enableRouteAnimation}
          onToggleAnimation={() => setEnableRouteAnimation(!enableRouteAnimation)}
          onShowHelp={() => setShowHelpModal(true)}
          onShowLogin={() => setShowLoginModal(true)}
          isStreetViewMode={isStreetViewMode}
        />
      </div>

      <div className="App-body">
        <div className="map-container">
          {apiKey ? (
            <div style={{ position: "relative", height: "100%", width: "100%" }}>
              <GoogleMap
                apiKey={apiKey}
                center={mapCenter}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                userPosition={userPosition}
                onStreetViewModeChange={handleStreetViewModeChange}
                allRoutes={savedRoutes}
                visibleRoutes={visibleRoutes}
                selectedRouteId={selectedRouteId}
                onRouteSelect={handleSelectRoute}
                routePoints={editableRoute}
                isCreationMode={isCreationMode}
                isEditMode={isEditMode}
                onMapClick={handleMapClick}
                onRouteLineClick={handleRouteLineClick}
                onPointDrag={handlePointDrag}
                onPointDelete={handlePointDelete}
                onPointDoubleClick={handlePointDoubleClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onMapReady={(map) => {
                  mapRef.current = map;
                }}
                currentLocationMarker={currentLocationMarker}
                enableAnimation={enableRouteAnimation}
                animationType="draw"
              />

              {!isStreetViewMode && (
                <CurrentLocationButton
                  onLocationToggle={handleLocationToggle}
                  disabled={loading}
                  isTracking={isTracking}
                />
              )}

              {/* 地図中央の十字マーク（編集・作成時のみ表示） */}
              <CrosshairOverlay isCreationMode={isCreationMode} isEditMode={isEditMode} />

              {/* 編集・作成時のアクションボタン領域 */}
              <RouteCreationControls
                isCreationMode={isCreationMode}
                isEditMode={isEditMode}
                editingMode={editingMode}
                undoStack={undoStack}
                onSave={handleActionSave}
                onModeToggle={handleModeToggle}
                onCrosshairAction={handleCrosshairAction}
                onUndoOrRemoveLastPin={handleUndoOrRemoveLastPin}
                onCancel={handleActionCancel}
              />

              {/* ルートオーバーレイ（編集・作成時は非表示） */}
              {!isCreationMode && !isEditMode && !isStreetViewMode && (
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
                  onToggleExpanded={() => setIsRouteOverlayExpanded(!isRouteOverlayExpanded)}
                  overlayHeight={routeOverlayHeight}
                  onHeightChange={setRouteOverlayHeight}
                  isCreationMode={isCreationMode}
                  isEditMode={isEditMode}
                />
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              Google Maps API キーを設定してください
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showLoginModal && (
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      )}

      {showHelpModal && (
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      )}

      {showRouteFormModal && (
        <RouteFormModal
          isOpen={showRouteFormModal}
          onClose={() => {
            setShowRouteFormModal(false);
            setEditingRoute(null);
          }}
          mode={routeFormMode}
          // 新規保存用props
          onSave={routeFormMode === "save" ? handleSaveRoute : undefined}
          distance={routeFormMode === "save" ? calculateTotalDistance(editableRoute) : undefined}
          duration={routeFormMode === "save" ? 0 : undefined}
          // 編集用props
          onUpdate={routeFormMode === "edit" ? handleEditRoute : undefined}
          route={routeFormMode === "edit" ? editingRoute : undefined}
          isLoading={isSaving}
        />
      )}

      {showAIOptimizer && (
        <AIRouteOptimizerModal
          isOpen={showAIOptimizer}
          onClose={() => setShowAIOptimizer(false)}
          onGenerateRoute={handleAIGeneratedRoute}
          currentPosition={userPosition}
        />
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            padding: "12px 24px",
            borderRadius: "8px",
            backgroundColor: toastMessage.type === "success" ? "#4caf50" : "#f44336",
            color: "white",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {toastMessage.message}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
      />
    </div>
  );
};

export default MainApp;
