import React, { useEffect, useRef, useState } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import { RoutePoint } from "../hooks/useRunningRoute";
import { RunningRoute } from "../lib/supabase";
import CurrentLocationMarker from "./CurrentLocationMarker";
import RouteAnimationOverlay from "./RouteAnimationOverlay";
import RouteAnimationControls from "./RouteAnimationControls";
import { useRouteAnimation, AnimationType } from "../hooks/useRouteAnimation";

interface GoogleMapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  style?: React.CSSProperties;
  onMapReady?: (map: google.maps.Map) => void;
  userPosition?: google.maps.LatLngLiteral | null;
  routePoints?: RoutePoint[];
  isRecording?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  isCreationMode?: boolean;
  isEditMode?: boolean;
  onPointDrag?: (index: number, lat: number, lng: number) => void;
  onPointDelete?: (index: number) => void;
  onPointClick?: (index: number) => void;
  onRouteLineClick?: (lat: number, lng: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  allRoutes?: RunningRoute[];
  visibleRoutes?: Set<string>;
  selectedRouteId?: string;
  onRouteSelect?: (route: RunningRoute) => void;
  currentLocationMarker?: {
    position: { lat: number; lng: number };
    heading: number;
  } | null;
  onCurrentLocationFadeComplete?: () => void;
  onPointDoubleClick?: (index: number) => void;
  enableAnimation?: boolean;
  animationType?: AnimationType;
}

const MapComponent: React.FC<GoogleMapProps> = ({
  center,
  zoom,
  style,
  onMapReady,
  userPosition,
  routePoints = [],
  isRecording = false,
  onMapClick,
  isCreationMode = false,
  isEditMode = false,
  onPointDrag,
  onPointDelete,
  onPointClick,
  onRouteLineClick,
  onDragStart,
  onDragEnd,
  allRoutes = [],
  visibleRoutes = new Set(),
  selectedRouteId,
  onRouteSelect,
  currentLocationMarker,
  onCurrentLocationFadeComplete,
  onPointDoubleClick,
  enableAnimation = false,
  animationType = "draw",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // const userMarkerRef = useRef<google.maps.Marker | null>(null); // 使用しないため削除
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const distanceLabelsRef = useRef<google.maps.Marker[]>([]);
  const allRoutesPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const allRoutesMarkersRef = useRef<google.maps.Marker[]>([]);
  const allRoutesLabelsRef = useRef<google.maps.Marker[]>([]);
  const prevModeRef = useRef<{ isEditMode: boolean; isCreationMode: boolean }>({
    isEditMode: false,
    isCreationMode: false,
  });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const prevVisibleRoutesRef = useRef<Set<string>>(visibleRoutes);

  // アニメーション機能
  const {
    isAnimating,
    animationType: currentAnimationType,
    config,
    startAnimation,
    stopAnimation,
    updateConfig,
    setAnimationType,
  } = useRouteAnimation({
    type: animationType,
    autoStart: false,
  });

  useEffect(() => {
    if (ref.current && !mapRef.current) {
      mapRef.current = new google.maps.Map(ref.current, {
        center,
        zoom,
        mapTypeId: "roadmap",
        // ランニングアプリに適した設定
        disableDefaultUI: true, // 全てのデフォルトUIを無効化
        zoomControl: true, // ズームコントロールのみ有効
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: true,
        rotateControl: false,
        fullscreenControl: false,
        panControl: false, // パンコントロールを明示的に無効化
        // 店舗などの情報ウィンドウを無効化
        clickableIcons: false,
        // 編集モード時の右クリックメニューを無効化
        disableDoubleClickZoom: false,
        // コントロールの位置を調整
        zoomControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
        streetViewControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
        gestureHandling: "greedy", // ジェスチャー操作を許可
      } as google.maps.MapOptions);

      // 編集モード時に右クリックコンテキストメニューを無効化
      if (isEditMode) {
        mapRef.current.addListener("rightclick", (e: google.maps.MapMouseEvent) => {
          e.stop();
        });
      }

      // マップ準備完了をコールバック
      if (onMapReady) {
        onMapReady(mapRef.current);
      }
    }
  }, [center, zoom, onMapReady, isEditMode]);

  // ズーム変更時の再描画用のstate
  const [zoomTrigger, setZoomTrigger] = useState(0);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ズーム変更イベントリスナーを管理（デバウンス処理追加）
  useEffect(() => {
    if (mapRef.current) {
      // 既存のリスナーをクリア
      if (zoomListenerRef.current) {
        google.maps.event.removeListener(zoomListenerRef.current);
      }

      // ズーム変更イベントリスナーを追加
      zoomListenerRef.current = mapRef.current.addListener("zoom_changed", () => {
        // 既存のタイマーをクリア（デバウンス）
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }

        // ズーム変更時にマーカーを再描画（全モードで実行）
        if (routeMarkersRef.current.length > 0 || allRoutesMarkersRef.current.length > 0) {
          // デバウンス: 300ms後に実行（連続ズーム時は最後のみ実行）
          zoomTimeoutRef.current = setTimeout(() => {
            setZoomTrigger((prev) => prev + 1);
          }, 300);
        }
      });

      return () => {
        if (zoomListenerRef.current) {
          google.maps.event.removeListener(zoomListenerRef.current);
        }
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
      };
    }
  }, [isEditMode, isCreationMode]);

  // 地図クリックイベントを別のuseEffectで管理
  useEffect(() => {
    if (mapRef.current && (isCreationMode || isEditMode) && onMapClick) {
      const clickListener = mapRef.current.addListener(
        "click",
        (event: google.maps.MapMouseEvent) => {
          // ドラッグ中は地図クリックを無視
          if (isDraggingRef.current) {
            console.log("Map click ignored - dragging in progress");
            event.stop();
            if (event.domEvent) {
              event.domEvent.stopPropagation();
              event.domEvent.preventDefault();
            }
            return;
          }

          // マーカー上でのクリックかどうかをチェック
          if (event.domEvent && event.domEvent.target) {
            const target = event.domEvent.target as HTMLElement;
            // マーカーやピンの要素をクリックした場合は地図クリックとして処理しない
            if (
              target.closest('[role="button"]') ||
              target.closest('img[src*="marker"]') ||
              target.tagName === "IMG"
            ) {
              return;
            }
          }

          if (event.latLng) {
            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            console.log("Map click processed at:", lat, lng);
            onMapClick(lat, lng);
          }
        }
      );

      // クリーンアップ関数でリスナーを削除
      return () => {
        google.maps.event.removeListener(clickListener);
      };
    }
  }, [isCreationMode, isEditMode, onMapClick]);

  // ユーザー位置でマップの中心を移動
  useEffect(() => {
    if (
      mapRef.current &&
      userPosition &&
      !isRecording &&
      !isEditMode &&
      !isCreationMode &&
      !selectedRouteId &&
      visibleRoutes.size === 0
    ) {
      mapRef.current.panTo(userPosition);
    }
  }, [userPosition, isRecording, isEditMode, isCreationMode, selectedRouteId, visibleRoutes]);

  // ルート変更時の地図位置調整（編集モード・手動作成モード時は無効）
  useEffect(() => {
    // 全表示から個別表示への切り替えかどうかをチェック
    const wasShowingRoutes = prevVisibleRoutesRef.current.size > 0;
    const isChangingFromAllToSingle = wasShowingRoutes && visibleRoutes.size === 0;

    // 前回の状態を更新
    prevVisibleRoutesRef.current = visibleRoutes;

    // 全表示から個別表示への切り替え時は移動しない
    if (isChangingFromAllToSingle) {
      return;
    }

    if (
      mapRef.current &&
      routePoints.length > 0 &&
      visibleRoutes.size === 0 &&
      !isEditMode &&
      !isCreationMode
    ) {
      // ルートの境界を計算
      const bounds = new google.maps.LatLngBounds();
      routePoints.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });

      // 地図をルートの範囲に合わせて調整
      mapRef.current.fitBounds(bounds, {
        top: 80, // 上部のコントロールエリア用のパディング
        bottom: 80, // 下部の統計情報エリア用のパディング
        left: 40, // 左右のパディング
        right: 40,
      });
    }
  }, [routePoints, visibleRoutes, selectedRouteId, isEditMode, isCreationMode]);

  // ランニングルートの描画
  useEffect(() => {
    if (mapRef.current && routePoints.length > 0) {
      const path = routePoints.map((point) => ({
        lat: point.lat,
        lng: point.lng,
      }));

      if (routePolylineRef.current) {
        // 既存のポリラインを更新
        routePolylineRef.current.setPath(path);
      } else {
        // 新しいポリラインを作成
        routePolylineRef.current = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: isRecording ? "#FF0000" : isEditMode ? "#FF8C00" : "#0000FF",
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map: mapRef.current,
          zIndex: isEditMode || isCreationMode ? 1000 : 1,
        });
      }

      // 編集モード時にポリラインクリックでピン挿入（常に追加し直す）
      if (routePolylineRef.current) {
        // 既存のリスナーをクリア
        google.maps.event.clearListeners(routePolylineRef.current, "click");

        if ((isEditMode || isCreationMode) && onRouteLineClick) {
          routePolylineRef.current.addListener("click", (event: google.maps.MapMouseEvent) => {
            // ドラッグ中はポリラインクリックを無視
            if (isDraggingRef.current) {
              console.log("Polyline click ignored - dragging in progress");
              event.stop();
              if (event.domEvent) {
                event.domEvent.stopPropagation();
                event.domEvent.preventDefault();
              }
              return;
            }

            if (event.latLng) {
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              console.log("Polyline click processed at:", lat, lng);
              onRouteLineClick(lat, lng);
            }
          });
        }
      }

      // 記録中・編集中・個別表示の場合、線の色とzIndexを更新
      if (routePolylineRef.current) {
        routePolylineRef.current.setOptions({
          strokeColor: isRecording ? "#FF0000" : isEditMode ? "#FF8C00" : "#0000FF",
        });
      }
    } else if (routePolylineRef.current) {
      // ルートがない場合はポリラインを削除
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, [routePoints, isRecording, isEditMode, isCreationMode, onRouteLineClick, zoomTrigger]);

  // 最新の関数をRefで保持（useEffect削除）
  const onPointDragRef = useRef(onPointDrag);
  const onPointDeleteRef = useRef(onPointDelete);
  onPointDragRef.current = onPointDrag;
  onPointDeleteRef.current = onPointDelete;

  // 距離ラベルとピンの位置を管理する配列
  const labelPositionsRef = useRef<{ lat: number; lng: number }[]>([]);
  const pinPositionsRef = useRef<{ lat: number; lng: number }[]>([]);

  // 重なりを避けるためのピンと距離ラベル位置計算関数（全体最適化版）
  const calculateAllPositions = (allPoints: RoutePoint[], currentZoom: number = 15) => {
    // ズーム値に応じてオフセットを調整（ズームが高い＝拡大時は小さく、ズームが低い＝縮小時は大きく）
    const zoomFactor = Math.pow(2, 15 - currentZoom); // 基準ズーム15からの倍率
    const pinOffsetY = 0.00015 * zoomFactor; // ピン用のY方向オフセット（ズーム対応、調整）
    const labelOffsetY = 0.0002 * zoomFactor; // 距離ラベル用のY方向オフセット（ズーム対応、調整）
    const labelOffsetYStep = 0.00012 * zoomFactor; // 距離ラベル用のY方向調整ステップ（ズーム対応、調整）
    const overlapThreshold = 0.0002 * zoomFactor; // ピン重なり判定閾値（ズーム対応、調整）
    const labelOverlapThreshold = 0.00025 * zoomFactor; // 距離ラベル重なり判定閾値（ズーム対応、調整）

    const pinPositions: { lat: number; lng: number }[] = [];
    const labelPositions: { lat: number; lng: number }[] = [];

    // ズーム11以下の場合は重なり考慮不要
    const skipOverlapCalculation = currentZoom <= 11;

    for (let currentIndex = 0; currentIndex < allPoints.length; currentIndex++) {
      const currentPoint = allPoints[currentIndex];

      // ピンの候補位置リスト（上方向にずらす）
      const pinCandidates = [
        { lat: currentPoint.lat, lng: currentPoint.lng }, // 中央（通常位置）
        { lat: currentPoint.lat + pinOffsetY, lng: currentPoint.lng }, // 上
        { lat: currentPoint.lat + pinOffsetY * 5, lng: currentPoint.lng }, // 上（遠）
        { lat: currentPoint.lat + pinOffsetY * 10, lng: currentPoint.lng }, // 上（最遠）
        { lat: currentPoint.lat + pinOffsetY * 15, lng: currentPoint.lng }, // 上（超遠）
        { lat: currentPoint.lat + pinOffsetY * 20, lng: currentPoint.lng }, // 上（極遠）
        { lat: currentPoint.lat + pinOffsetY * 25, lng: currentPoint.lng }, // 上（最極遠）
      ];

      // ピンの最適な位置を見つける
      let bestPinPosition = pinCandidates[0];

      // ズーム11以下の場合は重なり計算をスキップ
      if (!skipOverlapCalculation) {
        for (const candidatePos of pinCandidates) {
          let hasOverlap = false;

          // すでに配置されたピンとの重なりをチェック
          for (let i = 0; i < currentIndex; i++) {
            const existingPinPos = pinPositions[i];

            const distance = Math.sqrt(
              Math.pow(candidatePos.lat - existingPinPos.lat, 2) +
                Math.pow(candidatePos.lng - existingPinPos.lng, 2)
            );

            if (distance < overlapThreshold) {
              hasOverlap = true;
              break;
            }
          }

          // 重なりがない位置が見つかったら採用
          if (!hasOverlap) {
            bestPinPosition = candidatePos;
            break;
          }
        }
      }

      pinPositions.push(bestPinPosition);

      // 距離ラベルの位置計算（重なりを避けて上方向に調整）
      let labelYOffset = labelOffsetY;
      let labelPosition = {
        lat: bestPinPosition.lat + labelYOffset,
        lng: bestPinPosition.lng,
      };

      // 既存の距離ラベルとの重なりをチェックして上方向に調整（ズーム11以下の場合はスキップ）
      if (!skipOverlapCalculation) {
        let labelHasOverlap = true;
        let attempts = 0;
        const maxAttempts = 10; // 最大調整回数

        while (labelHasOverlap && attempts < maxAttempts) {
          labelHasOverlap = false;

          // すでに配置された距離ラベルとの重なりをチェック
          for (let i = 0; i < currentIndex; i++) {
            const existingLabelPos = labelPositions[i];

            const distance = Math.sqrt(
              Math.pow(labelPosition.lat - existingLabelPos.lat, 2) +
                Math.pow(labelPosition.lng - existingLabelPos.lng, 2)
            );

            if (distance < labelOverlapThreshold) {
              labelHasOverlap = true;
              break;
            }
          }

          // 重なりがある場合は上にずらす
          if (labelHasOverlap) {
            labelYOffset += labelOffsetYStep;
            labelPosition = {
              lat: bestPinPosition.lat + labelYOffset,
              lng: bestPinPosition.lng,
            };
            attempts++;
          }
        }
      }

      labelPositions.push(labelPosition);
    }

    return { pinPositions, labelPositions };
  };

  // 個別の位置計算関数（互換性のため）
  const calculateLabelPosition = (
    currentPoint: RoutePoint,
    currentIndex: number,
    allPoints: RoutePoint[]
  ) => {
    // 全体最適化された位置を取得
    if (
      labelPositionsRef.current.length === 0 ||
      labelPositionsRef.current.length !== allPoints.length
    ) {
      const currentZoom = mapRef.current?.getZoom() || 15;
      const positions = calculateAllPositions(allPoints, currentZoom);
      labelPositionsRef.current = positions.labelPositions;
      pinPositionsRef.current = positions.pinPositions;
    }

    return (
      labelPositionsRef.current[currentIndex] || {
        lat: currentPoint.lat + 0.0006,
        lng: currentPoint.lng,
      }
    );
  };

  // ピンの位置を取得する関数
  const calculatePinPosition = (
    currentPoint: RoutePoint,
    currentIndex: number,
    allPoints: RoutePoint[]
  ) => {
    // 全体最適化された位置を取得
    if (
      pinPositionsRef.current.length === 0 ||
      pinPositionsRef.current.length !== allPoints.length
    ) {
      const currentZoom = mapRef.current?.getZoom() || 15;
      const positions = calculateAllPositions(allPoints, currentZoom);
      labelPositionsRef.current = positions.labelPositions;
      pinPositionsRef.current = positions.pinPositions;
    }

    return (
      pinPositionsRef.current[currentIndex] || {
        lat: currentPoint.lat,
        lng: currentPoint.lng,
      }
    );
  };

  // ルートポイントマーカーの描画（編集モード、手動作成モード、または個別ルート表示時）
  useEffect(() => {
    // ルートポイントが変更された時に位置キャッシュをリセット
    labelPositionsRef.current = [];
    pinPositionsRef.current = [];

    // 表示すべき状態かチェック（編集モードまたは手動作成モード時は常に表示）
    const shouldShowMarkersAndLabels =
      isEditMode || isCreationMode || (routePoints.length > 0 && visibleRoutes.size === 0);

    if (!shouldShowMarkersAndLabels) {
      routeMarkersRef.current.forEach((marker) => marker.setMap(null));
      routeMarkersRef.current = [];
      distanceLabelsRef.current.forEach((label) => label.setMap(null));
      distanceLabelsRef.current = [];
      return;
    }

    // 距離計算関数
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000; // 地球の半径（メートル）
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // 累積距離計算
    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < routePoints.length; i++) {
      const distance = calculateDistance(
        routePoints[i - 1].lat,
        routePoints[i - 1].lng,
        routePoints[i].lat,
        routePoints[i].lng
      );
      cumulativeDistances.push(cumulativeDistances[i - 1] + distance);
    }

    // ポイント数が変わった場合、または編集・手動作成モードが変わった場合のみ再描画
    const modeChanged =
      prevModeRef.current.isEditMode !== isEditMode ||
      prevModeRef.current.isCreationMode !== isCreationMode;
    const needsRedraw = routeMarkersRef.current.length !== routePoints.length || modeChanged;

    // 現在のモードを記録
    prevModeRef.current = { isEditMode, isCreationMode };

    if (!needsRedraw) {
      // ポイント数が同じ場合は位置とラベルを更新
      routePoints.forEach((point, index) => {
        if (routeMarkersRef.current[index]) {
          routeMarkersRef.current[index].setPosition({ lat: point.lat, lng: point.lng });
        }
        if (distanceLabelsRef.current[index]) {
          const formatDistance = (meters: number) => {
            if (meters < 1000) {
              return `${meters.toFixed(0)}m`;
            }
            return `${(meters / 1000).toFixed(2)}km`;
          };

          const labelPosition = calculateLabelPosition(point, index, routePoints);
          distanceLabelsRef.current[index].setPosition(labelPosition);

          // 距離ラベルのアイコンも更新
          distanceLabelsRef.current[index].setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="20" viewBox="0 0 60 20">
                <rect x="0" y="0" width="60" height="20" rx="10" fill="rgba(0,0,0,0.7)" stroke="white" stroke-width="1"/>
                <text x="30" y="14" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">
                  ${formatDistance(cumulativeDistances[index])}
                </text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(60, 20),
            anchor: new google.maps.Point(30, 30),
          });
        }
      });
      return;
    }

    // 既存のマーカーをクリア
    routeMarkersRef.current.forEach((marker) => marker.setMap(null));
    routeMarkersRef.current = [];
    distanceLabelsRef.current.forEach((label) => label.setMap(null));
    distanceLabelsRef.current = [];

    if (mapRef.current && shouldShowMarkersAndLabels && routePoints.length > 0) {
      // ズームレベルに応じた間引き処理
      const getDisplayIndices = () => {
        // 編集モード・手動作成モード時は全ポイント表示
        if (isEditMode || isCreationMode) {
          return routePoints.map((_, index) => index);
        }

        // ズームレベルに応じて表示間隔を調整
        const currentZoom = mapRef.current?.getZoom() || 15;

        // ズーム16以上は全ピン表示
        if (currentZoom >= 16) {
          return routePoints.map((_, index) => index);
        }

        let targetInterval: number;

        if (currentZoom >= 14) {
          targetInterval = 500; // 高ズーム時は500m間隔
        } else if (currentZoom >= 12) {
          targetInterval = 1000; // 中ズーム時は1000m間隔
        } else {
          targetInterval = 2000; // 低ズーム時は2000m間隔
        }

        // 間引き処理
        const displayIndices = [0]; // スタートは必ず含める
        let lastDisplayedDistance = 0;

        for (let i = 1; i < routePoints.length - 1; i++) {
          const currentDistance = cumulativeDistances[i];
          if (currentDistance - lastDisplayedDistance >= targetInterval) {
            displayIndices.push(i);
            lastDisplayedDistance = currentDistance;
          }
        }

        // ゴールは必ず含める
        if (routePoints.length > 1) {
          displayIndices.push(routePoints.length - 1);
        }

        return displayIndices;
      };

      const displayIndices = getDisplayIndices();

      displayIndices.forEach((index) => {
        const point = routePoints[index];
        const isStart = index === 0;
        const isEnd = index === routePoints.length - 1;

        const marker = new google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: mapRef.current!,
          draggable: false, // 初期状態は無効
          clickable: true,
          title: `${isStart ? "スタート" : isEnd ? "ゴール" : `ポイント ${index + 1}`}${
            isEditMode ? " (0.5秒: 移動開始, 1秒: 削除)" : ""
          }`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isStart || isEnd ? 8 : 6,
            fillColor: isStart
              ? "#28a745"
              : isEnd
              ? "#dc3545"
              : isEditMode || isCreationMode
              ? "#FF8C00"
              : "#0000FF",
            fillOpacity: 0.9,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
          optimized: false,
          zIndex: -100, // 編集・作成時は距離ラベルより後面
        });

        let longTapTimer: NodeJS.Timeout | null = null;
        let deleteTimer: NodeJS.Timeout | null = null;
        let touchStartTime = 0;
        let dragModeActive = false; // ドラッグモードの状態を管理
        let isManuallyDragging = false; // 手動ドラッグ中フラグ

        // グローバルなイベントリスナー用の変数
        let globalMouseUpListener: ((e: MouseEvent) => void) | null = null;
        let globalTouchEndListener: ((e: TouchEvent) => void) | null = null;
        let globalMouseMoveListener: ((e: MouseEvent) => void) | null = null;
        let globalTouchMoveListener: ((e: TouchEvent) => void) | null = null;

        // マウス/タッチダウンでロングタップ検出とドラッグ準備
        const handleMouseDown = (e: any) => {
          // 編集モード・手動作成モードでない場合は無効化
          if (!isEditMode && !isCreationMode) return;

          // 左クリック（button 0）またはタッチ
          if (e.domEvent && (e.domEvent.button === 0 || e.domEvent.type === "touchstart")) {
            // 最初はイベントを止めずに、ドラッグ開始時のみ止める
            // e.domEvent.preventDefault(); // コメントアウト

            touchStartTime = Date.now();

            // ドラッグ開始位置を記録
            const clientX = e.domEvent.touches ? e.domEvent.touches[0].clientX : e.domEvent.clientX;
            const clientY = e.domEvent.touches ? e.domEvent.touches[0].clientY : e.domEvent.clientY;

            dragStartPositionRef.current = {
              x: clientX,
              y: clientY,
            };

            // グローバルなmouseup/touchendリスナーを追加
            globalMouseUpListener = (upEvent: MouseEvent) => {
              handleGlobalMouseUp(upEvent);
            };

            globalTouchEndListener = (upEvent: TouchEvent) => {
              handleGlobalMouseUp(upEvent);
            };

            // マウス/タッチムーブリスナーも追加（ロングタップ後のドラッグ用）
            globalMouseMoveListener = (moveEvent: MouseEvent) => {
              handleGlobalMouseMove(moveEvent);
            };

            globalTouchMoveListener = (moveEvent: TouchEvent) => {
              handleGlobalTouchMove(moveEvent);
            };

            document.addEventListener("mouseup", globalMouseUpListener);
            document.addEventListener("touchend", globalTouchEndListener, { passive: false });
            document.addEventListener("mousemove", globalMouseMoveListener);
            document.addEventListener("touchmove", globalTouchMoveListener, { passive: false });

            // 500ms後にドラッグモードを開始
            longTapTimer = setTimeout(() => {
              // ドラッグモード開始
              dragModeActive = true;
              isDraggingRef.current = true;

              // ドラッグ開始コールバック
              if (onDragStart) {
                onDragStart();
              }

              // マーカーのドラッグを有効化
              marker.setDraggable(true);

              // マーカーの色を変更してドラッグモード中を示す
              marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: isStart || isEnd ? 10 : 8,
                fillColor: "#FF69B4",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
              });

              // マップのドラッグを無効化
              if (mapRef.current) {
                mapRef.current.setOptions({ draggable: false });
              }

              // 手動ドラッグを開始
              isManuallyDragging = true;

              // さらに1秒後（合計1.5秒）で削除処理
              deleteTimer = setTimeout(() => {
                if (onPointDeleteRef.current) {
                  console.log("1.5 second long tap detected - deleting pin", index);

                  // 削除前にマーカーのドラッグを完全に無効化
                  marker.setDraggable(false);
                  dragModeActive = false;
                  isDraggingRef.current = false;
                  isManuallyDragging = false;

                  // マーカーを地図から削除
                  marker.setMap(null);

                  // すべてのイベントリスナーをクリア
                  google.maps.event.clearInstanceListeners(marker);

                  // グローバルリスナーもクリーンアップ
                  if (globalMouseUpListener) {
                    document.removeEventListener("mouseup", globalMouseUpListener);
                    globalMouseUpListener = null;
                  }
                  if (globalTouchEndListener) {
                    document.removeEventListener("touchend", globalTouchEndListener);
                    globalTouchEndListener = null;
                  }
                  if (globalMouseMoveListener) {
                    document.removeEventListener("mousemove", globalMouseMoveListener);
                    globalMouseMoveListener = null;
                  }
                  if (globalTouchMoveListener) {
                    document.removeEventListener("touchmove", globalTouchMoveListener);
                    globalTouchMoveListener = null;
                  }

                  // 削除処理を実行
                  onPointDeleteRef.current(index);
                }
              }, 1000); // さらに1000ms後
            }, 100); // 500ms長押しでドラッグモード開始
          }
        };

        // グローバルなマウス/タッチムーブ処理（ロングタップ後のドラッグ用）
        const handleGlobalMouseMove = (e: MouseEvent) => {
          // マーカーが削除されている場合は処理を中止
          if (!marker.getMap()) {
            return;
          }
          if (dragModeActive && isManuallyDragging && mapRef.current) {
            // 実際にドラッグが開始されたら削除タイマーをクリア
            if (longTapTimer) {
              clearTimeout(longTapTimer);
              longTapTimer = null;
            }
            if (deleteTimer) {
              clearTimeout(deleteTimer);
              deleteTimer = null;
            }

            // マウス座標をマップ座標に変換
            const mapDiv = mapRef.current.getDiv();
            const rect = mapDiv.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // マップ境界内でのみ処理
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
              const bounds = mapRef.current.getBounds();
              if (bounds) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / rect.height);
                const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / rect.width);

                const newPos = new google.maps.LatLng(lat, lng);
                marker.setPosition(newPos);

                if (onPointDragRef.current) {
                  onPointDragRef.current(index, lat, lng);
                }
              }
            }
          }
        };

        const handleGlobalTouchMove = (e: TouchEvent) => {
          // マーカーが削除されている場合は処理を中止
          if (!marker.getMap()) {
            return;
          }
          if (dragModeActive && isManuallyDragging && mapRef.current && e.touches.length > 0) {
            // 実際にドラッグが開始されたら削除タイマーをクリア
            if (longTapTimer) {
              clearTimeout(longTapTimer);
              longTapTimer = null;
            }
            if (deleteTimer) {
              clearTimeout(deleteTimer);
              deleteTimer = null;
            }

            const touch = e.touches[0];
            // マウス座標をマップ座標に変換
            const mapDiv = mapRef.current.getDiv();
            const rect = mapDiv.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // マップ境界内でのみ処理
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
              const bounds = mapRef.current.getBounds();
              if (bounds) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / rect.height);
                const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / rect.width);

                const newPos = new google.maps.LatLng(lat, lng);
                marker.setPosition(newPos);

                if (onPointDragRef.current) {
                  onPointDragRef.current(index, lat, lng);
                }
              }
            }
          }
        };

        // グローバルなマウスアップ/タッチエンド処理
        const handleGlobalMouseUp = (_e: MouseEvent | TouchEvent) => {
          // ロングタップタイマーをクリア
          if (longTapTimer) {
            clearTimeout(longTapTimer);
            longTapTimer = null;
          }
          // 削除タイマーもクリア
          if (deleteTimer) {
            clearTimeout(deleteTimer);
            deleteTimer = null;
          }

          // ドラッグモード終了処理
          if (dragModeActive) {
            dragModeActive = false;
            isManuallyDragging = false;
            isDraggingRef.current = false;

            // マーカーのドラッグを無効化
            marker.setDraggable(false);

            // マーカーの色を元に戻す
            marker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: isStart || isEnd ? 8 : 6,
              fillColor: isStart ? "#28a745" : isEnd ? "#dc3545" : "#FF8C00",
              fillOpacity: 0.9,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            });

            // 地図のドラッグを再有効化
            if (mapRef.current) {
              mapRef.current.setOptions({ draggable: true });
            }

            // ドラッグ終了コールバック
            if (onDragEnd) {
              onDragEnd();
            }
          }

          // グローバルリスナーをクリーンアップ
          if (globalMouseUpListener) {
            document.removeEventListener("mouseup", globalMouseUpListener);
            globalMouseUpListener = null;
          }
          if (globalTouchEndListener) {
            document.removeEventListener("touchend", globalTouchEndListener);
            globalTouchEndListener = null;
          }
          if (globalMouseMoveListener) {
            document.removeEventListener("mousemove", globalMouseMoveListener);
            globalMouseMoveListener = null;
          }
          if (globalTouchMoveListener) {
            document.removeEventListener("touchmove", globalTouchMoveListener);
            globalTouchMoveListener = null;
          }
        };

        // マーカー上でのマウスアップ/タッチエンド処理（ダブルタップ検出用）
        const handleMouseUp = (_e: any) => {
          // ドラッグモードがアクティブでない場合のみクリック処理を継続
          if (!dragModeActive) {
            const clickDuration = Date.now() - touchStartTime;
            // 短いタップ（500ms未満）の場合のみクリック処理を継続
            if (clickDuration < 500) {
              // 通常のクリック処理（ダブルタップ検出用）
              // この処理はclickイベントで行う
            }
          }
        };

        // クリックイベント（ドラッグモード中は無視）
        marker.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!isEditMode && !isCreationMode) return;

          // ドラッグモード中はクリックを無視
          if (dragModeActive || isDraggingRef.current) {
            e.stop();
            if (e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
            }
            return;
          }

          // シンプルなクリック処理
          if (onPointClick) {
            onPointClick(index);
          }
        });

        // ダブルクリックイベント（往復ルート追加用）
        marker.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
          if (!isEditMode && !isCreationMode) return;

          // ドラッグモード中はダブルクリックを無視
          if (dragModeActive || isDraggingRef.current) {
            e.stop();
            if (e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
            }
            return;
          }

          // 往復ルート追加処理
          if (onPointDoubleClick) {
            onPointDoubleClick(index);
          }
        });

        // マーカーのネイティブドラッグイベント
        marker.addListener("drag", (e: google.maps.MapMouseEvent) => {
          // マーカーが削除されている場合は処理を中止
          if (!marker.getMap()) {
            return;
          }
          if (e.latLng) {
            if (onPointDragRef.current) {
              onPointDragRef.current(index, e.latLng.lat(), e.latLng.lng());
            }
          }
        });

        marker.addListener("dragend", () => {
          // ドラッグ終了時の処理
          dragModeActive = false;
          isDraggingRef.current = false;

          // マーカーのドラッグを無効化
          marker.setDraggable(false);

          // マーカーの色を元に戻す
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: isStart || isEnd ? 8 : 6,
            fillColor: isStart ? "#28a745" : isEnd ? "#dc3545" : "#FF8C00",
            fillOpacity: 0.9,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          });

          // マップのドラッグを再有効化
          if (mapRef.current) {
            mapRef.current.setOptions({ draggable: true });
          }

          // ドラッグ終了コールバック
          if (onDragEnd) {
            onDragEnd();
          }
        });

        marker.addListener("mousedown", handleMouseDown);
        marker.addListener("mouseup", handleMouseUp);
        marker.addListener("touchstart", handleMouseDown);
        marker.addListener("touchend", handleMouseUp);

        // 右クリックで削除（編集モード・手動作成モードで有効）
        marker.addListener("rightclick", (e: google.maps.MapMouseEvent) => {
          e.stop(); // イベント伝播を停止
          if (e.domEvent) {
            e.domEvent.stopPropagation();
            e.domEvent.preventDefault();
          }
          if (isEditMode || isCreationMode) {
            // 削除前にマーカーのドラッグを完全に無効化
            marker.setDraggable(false);
            dragModeActive = false;
            isDraggingRef.current = false;
            isManuallyDragging = false;

            // マーカーを地図から削除
            marker.setMap(null);

            // すべてのイベントリスナーをクリア
            google.maps.event.clearInstanceListeners(marker);

            // 最新のonPointDelete関数を使用
            if (onPointDeleteRef.current) {
              onPointDeleteRef.current(index);
            }
          }
        });

        routeMarkersRef.current.push(marker);

        // 距離ラベルを作成
        const formatDistance = (meters: number) => {
          if (meters < 1000) {
            return `${meters.toFixed(0)}m`;
          }
          return `${(meters / 1000).toFixed(2)}km`;
        };

        const labelPosition = calculateLabelPosition(point, index, routePoints);

        const distanceLabel = new google.maps.Marker({
          position: labelPosition,
          map: mapRef.current!,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="20" viewBox="0 0 60 20">
                <rect x="0" y="0" width="60" height="20" rx="10" fill="rgba(0,0,0,0.7)" stroke="white" stroke-width="1"/>
                <text x="30" y="14" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">
                  ${formatDistance(cumulativeDistances[index])}
                </text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(60, 20),
            anchor: new google.maps.Point(30, 30), // 中心点を調整
          },
          zIndex: isEditMode || isCreationMode ? 800 : 50, // 編集・作成時の距離ラベル最前面表示
        });

        distanceLabelsRef.current.push(distanceLabel);
      });
    }
  }, [routePoints, isEditMode, isCreationMode, visibleRoutes, zoomTrigger]);

  // 全ルート表示機能
  useEffect(() => {
    if (!mapRef.current) return;

    // 既存の全ルート要素をクリア
    allRoutesPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    allRoutesPolylinesRef.current = [];
    allRoutesMarkersRef.current.forEach((marker) => marker.setMap(null));
    allRoutesMarkersRef.current = [];
    allRoutesLabelsRef.current.forEach((label) => label.setMap(null));
    allRoutesLabelsRef.current = [];

    // 全ルート表示のON/OFF切り替え時の処理
    if (visibleRoutes.size > 0 && allRoutes.length > 0) {
      // visibleRoutesに含まれるルートのみを表示
      const routesToDisplay = allRoutes.filter((route) => visibleRoutes.has(route.id));

      routesToDisplay.forEach((route, routeIndex) => {
        // 距離計算関数
        const calculateDistance = (
          lat1: number,
          lng1: number,
          lat2: number,
          lng2: number
        ): number => {
          const R = 6371000; // 地球の半径（メートル）
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLng = ((lng2 - lng1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const formatDistance = (meters: number) => {
          if (meters < 1000) {
            return `${meters.toFixed(0)}m`;
          }
          return `${(meters / 1000).toFixed(2)}km`;
        };

        if (route.route_data?.coordinates) {
          const path = route.route_data.coordinates.map((coord) => ({
            lat: coord[1],
            lng: coord[0],
          }));

          const isSelected = route.id === selectedRouteId;

          // 選択ルートが編集モード時は非表示、その他は通常表示
          if (isSelected && (isEditMode || isCreationMode)) {
            // 選択されたルートが編集モード時はポリラインを表示しない
            return;
          }

          // 選択ルートはハイライト、その他はより見やすく表示
          const routeOpacity = isSelected ? 1.0 : 0.4; // 非選択ルートをより薄く
          const routeWeight = isSelected ? 5 : 2; // 選択ルートをより太く、非選択をより細く
          const routeColor = isSelected ? "#0000FF" : "#666666"; // 非選択ルートはグレー

          // ポリライン作成
          const polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: routeColor,
            strokeOpacity: routeOpacity,
            strokeWeight: routeWeight,
            map: mapRef.current,
            zIndex: isSelected ? 10 : -routeIndex, // 選択ルートを前面表示、非選択は後方に重ねる
          });

          // ポリラインクリック処理
          if (!isEditMode && !isCreationMode) {
            // 通常時：ルート選択
            polyline.addListener("click", () => {
              if (onRouteSelect) {
                onRouteSelect(route);
              }
            });
          } else if (!isSelected && (isEditMode || isCreationMode) && onMapClick) {
            // 編集・作成モード時の未選択ルート：ピン追加
            polyline.addListener("click", (event: google.maps.MapMouseEvent) => {
              if (event.latLng) {
                onMapClick(event.latLng.lat(), event.latLng.lng());
              }
            });
          }

          allRoutesPolylinesRef.current.push(polyline);

          // すべてのルートにピンと距離ラベルを表示
          // 累積距離計算
          const cumulativeDistances: number[] = [0];
          for (let i = 1; i < path.length; i++) {
            const distance = calculateDistance(
              path[i - 1].lat,
              path[i - 1].lng,
              path[i].lat,
              path[i].lng
            );
            cumulativeDistances.push(cumulativeDistances[i - 1] + distance);
          }

          // パフォーマンス改善：ズームレベルに応じた距離ベース間引き
          const getDisplayPoints = () => {
            const currentZoom = mapRef.current?.getZoom() || 15;

            // 選択ルートは全ピン表示
            if (isSelected) {
              return path.map((_, index) => index);
            }

            // 非選択ルートはズームレベルに応じて間引き
            let targetInterval: number;
            if (currentZoom >= 16) {
              targetInterval = 500; // 高ズーム: より詳細表示
            } else if (currentZoom >= 14) {
              targetInterval = 1000; // 中ズーム: 標準表示
            } else {
              targetInterval = 2000; // 低ズーム: 簡略表示
            }

            // 選択・非選択共に動的間隔で表示
            const displayIndices = [0]; // スタートは必ず含める
            let lastDisplayedDistance = 0;

            for (let i = 1; i < path.length - 1; i++) {
              const currentDistance = cumulativeDistances[i];
              if (currentDistance - lastDisplayedDistance >= targetInterval) {
                displayIndices.push(i);
                lastDisplayedDistance = currentDistance;
              }
            }

            // ゴールは必ず含める
            if (path.length > 1) {
              displayIndices.push(path.length - 1);
            }

            return displayIndices;
          };

          const displayIndices = getDisplayPoints();

          // ピン作成（すべてのポイントに対してピンを作成）
          path.forEach((point, pointIndex) => {
            const isStart = pointIndex === 0;
            const isEnd = pointIndex === path.length - 1;

            // 選択ルートが編集モード時はマーカーも非表示
            if (isSelected && (isEditMode || isCreationMode)) {
              return;
            }

            // ピン作成（全ポイントに表示）
            const marker = new google.maps.Marker({
              position: point,
              map: mapRef.current!,
              title: `${route.name} - ${
                isStart ? "スタート" : isEnd ? "ゴール" : `ポイント ${pointIndex + 1}`
              }`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? (isStart || isEnd ? 8 : 6) : 4,
                fillColor: isSelected
                  ? isStart
                    ? "#28a745"
                    : isEnd
                    ? "#dc3545"
                    : "#0000FF"
                  : "#666666",
                fillOpacity: isSelected ? 0.9 : 0.7,
                strokeColor: "#FFFFFF",
                strokeWeight: isSelected ? 2 : 1.5,
              },
              optimized: false,
              zIndex: isSelected ? -80 : isEditMode || isCreationMode ? -120 : -100,
            });

            // 編集・作成モード時に未選択ルートのピンクリックでピン追加
            if (!isSelected && (isEditMode || isCreationMode) && onMapClick) {
              marker.addListener("click", () => {
                onMapClick(point.lat, point.lng);
              });
            }

            allRoutesMarkersRef.current.push(marker);
          });

          // 距離ラベル作成（間引き表示）
          displayIndices.forEach((pointIndex) => {
            const point = path[pointIndex];

            // 選択ルートが編集モード時は距離ラベルも非表示
            if (isSelected && (isEditMode || isCreationMode)) {
              return;
            }

            // 選択ルートの距離ラベル間引き処理
            if (isSelected) {
              const currentZoom = mapRef.current?.getZoom() || 15;
              // ズームレベルに応じて間引きの間隔を調整
              let skipInterval = 1; // デフォルトは全て表示

              if (currentZoom <= 13) {
                skipInterval = 8; // 低ズーム時は8つおきに表示
              } else if (currentZoom <= 15) {
                skipInterval = 4; // 中ズーム時は4つおきに表示
              } else if (currentZoom <= 17) {
                skipInterval = 2; // 高ズーム時は2つおきに表示
              }

              // 最初と最後のポイントは常に表示、それ以外は間引き
              if (
                pointIndex !== 0 &&
                pointIndex !== path.length - 1 &&
                pointIndex % skipInterval !== 0
              ) {
                return;
              }
            }

            // 通常ルート時と同じ重なり処理を使用
            const currentZoom = mapRef.current?.getZoom() || 15;
            const allPointsForRoute = path.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              timestamp: Date.now(),
              accuracy: 1,
            }));
            const positions = calculateAllPositions(allPointsForRoute, currentZoom);
            const labelPosition = positions.labelPositions[pointIndex] || {
              lat: point.lat + (isSelected ? 0.0002 : 0.00015),
              lng: point.lng,
            };

            const distanceLabel = new google.maps.Marker({
              position: labelPosition,
              map: mapRef.current!,
              icon: {
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 60 : 45}" height="${
                  isSelected ? 20 : 16
                }" viewBox="0 0 ${isSelected ? 60 : 45} ${isSelected ? 20 : 16}">
                    <rect x="0" y="0" width="${isSelected ? 60 : 45}" height="${
                  isSelected ? 20 : 16
                }" rx="${isSelected ? 10 : 8}" fill="${
                  isSelected ? "rgba(0,0,0,0.8)" : "rgba(102,102,102,0.8)"
                }" stroke="${isSelected ? "white" : "#ddd"}" stroke-width="1"/>
                    <text x="${isSelected ? 30 : 22.5}" y="${
                  isSelected ? 14 : 11
                }" text-anchor="middle" fill="${
                  isSelected ? "white" : "white"
                }" font-family="Arial" font-size="${isSelected ? 12 : 9}" font-weight="bold">
                      ${formatDistance(cumulativeDistances[pointIndex])}
                    </text>
                  </svg>
                `)}`,
                scaledSize: new google.maps.Size(isSelected ? 60 : 45, isSelected ? 20 : 16),
                anchor: new google.maps.Point(isSelected ? 30 : 22.5, isSelected ? 30 : 24),
              },
              zIndex: isSelected
                ? 300
                : isEditMode || isCreationMode
                ? 200 + routeIndex
                : 250 + routeIndex,
            });

            allRoutesLabelsRef.current.push(distanceLabel);
          });
        }
      });

      // 全ルート表示時のマップ移動は無効化
      // ユーザーが手動で表示範囲を調整できるように変更
    }
  }, [visibleRoutes, allRoutes, selectedRouteId, zoomTrigger, isEditMode, isCreationMode]);

  // 現在位置アイコンの表示制御

  return (
    <div ref={ref} style={style} onContextMenu={isEditMode ? (e) => e.preventDefault() : undefined}>
      {currentLocationMarker && mapRef.current && (
        <CurrentLocationMarker
          position={currentLocationMarker.position}
          heading={currentLocationMarker.heading}
          map={mapRef.current}
          onFadeComplete={onCurrentLocationFadeComplete}
        />
      )}

      {/* ルートアニメーション */}
      {enableAnimation && mapRef.current && (
        <>
          {routePoints && routePoints.length > 0 && (
            <RouteAnimationOverlay
              map={mapRef.current}
              routePoints={routePoints}
              isAnimating={isAnimating}
              animationType={currentAnimationType}
              animationSpeed={config.speed}
              color={config.color}
              lineWidth={config.lineWidth}
              onAnimationComplete={() => {
                console.log("Animation completed");
              }}
            />
          )}
          <RouteAnimationControls
            isAnimating={isAnimating}
            animationType={currentAnimationType}
            config={config}
            onStartAnimation={() => routePoints && startAnimation(routePoints)}
            onStopAnimation={stopAnimation}
            onTypeChange={setAnimationType}
            onConfigChange={updateConfig}
            disabled={!routePoints || routePoints.length === 0}
          />
        </>
      )}
    </div>
  );
};

interface GoogleMapWrapperProps {
  apiKey: string;
  center: google.maps.LatLngLiteral;
  zoom: number;
  style?: React.CSSProperties;
  onMapReady?: (map: google.maps.Map) => void;
  userPosition?: google.maps.LatLngLiteral | null;
  routePoints?: RoutePoint[];
  isRecording?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  isCreationMode?: boolean;
  isEditMode?: boolean;
  onPointDrag?: (index: number, lat: number, lng: number) => void;
  onPointDelete?: (index: number) => void;
  onPointClick?: (index: number) => void;
  onRouteLineClick?: (lat: number, lng: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  allRoutes?: RunningRoute[];
  visibleRoutes?: Set<string>;
  selectedRouteId?: string;
  onRouteSelect?: (route: RunningRoute) => void;
  currentLocationMarker?: {
    position: { lat: number; lng: number };
    heading: number;
  } | null;
  onCurrentLocationFadeComplete?: () => void;
  onPointDoubleClick?: (index: number) => void;
  enableAnimation?: boolean;
  animationType?: AnimationType;
}

const GoogleMap: React.FC<GoogleMapWrapperProps> = ({
  apiKey,
  center,
  zoom,
  style,
  onMapReady,
  userPosition,
  routePoints,
  isRecording,
  onMapClick,
  isCreationMode,
  isEditMode,
  onPointDrag,
  onPointDelete,
  onPointClick,
  onRouteLineClick,
  onDragStart,
  onDragEnd,
  allRoutes,
  visibleRoutes,
  selectedRouteId,
  onRouteSelect,
  currentLocationMarker,
  onCurrentLocationFadeComplete,
  onPointDoubleClick,
  enableAnimation,
  animationType,
}) => {
  const render = (status: any) => {
    switch (status) {
      case "LOADING":
        return <div>マップを読み込み中...</div>;
      case "FAILURE":
        return <div>マップの読み込みに失敗しました</div>;
      case "SUCCESS":
        return (
          <MapComponent
            center={center}
            zoom={zoom}
            style={style}
            onMapReady={onMapReady}
            userPosition={userPosition}
            routePoints={routePoints}
            isRecording={isRecording}
            onMapClick={onMapClick}
            isCreationMode={isCreationMode}
            isEditMode={isEditMode}
            onPointDrag={onPointDrag}
            onPointDelete={onPointDelete}
            onPointClick={onPointClick}
            onRouteLineClick={onRouteLineClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            allRoutes={allRoutes}
            visibleRoutes={visibleRoutes}
            selectedRouteId={selectedRouteId}
            onRouteSelect={onRouteSelect}
            currentLocationMarker={currentLocationMarker}
            onCurrentLocationFadeComplete={onCurrentLocationFadeComplete}
            onPointDoubleClick={onPointDoubleClick}
            enableAnimation={enableAnimation}
            animationType={animationType}
          />
        );
      default:
        return <div>マップを初期化中...</div>;
    }
  };

  return (
    <Wrapper apiKey={apiKey} render={render}>
      <MapComponent
        center={center}
        zoom={zoom}
        style={style}
        onMapReady={onMapReady}
        userPosition={userPosition}
        routePoints={routePoints}
        isRecording={isRecording}
        onMapClick={onMapClick}
        isCreationMode={isCreationMode}
        isEditMode={isEditMode}
        onPointDrag={onPointDrag}
        onPointDelete={onPointDelete}
        onPointClick={onPointClick}
        onRouteLineClick={onRouteLineClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        allRoutes={allRoutes}
        visibleRoutes={visibleRoutes}
        selectedRouteId={selectedRouteId}
        onRouteSelect={onRouteSelect}
        currentLocationMarker={currentLocationMarker}
        onCurrentLocationFadeComplete={onCurrentLocationFadeComplete}
        onPointDoubleClick={onPointDoubleClick}
        enableAnimation={enableAnimation}
        animationType={animationType}
      />
    </Wrapper>
  );
};

export default GoogleMap;
