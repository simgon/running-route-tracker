import React, { useEffect, useRef, useState } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import { RoutePoint } from "../hooks/useRunningRoute";
import { RunningRoute } from "../lib/supabase";
import CurrentLocationMarker from "./CurrentLocationMarker";

interface GoogleMapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  style?: React.CSSProperties;
  onMapReady?: (map: google.maps.Map) => void;
  userPosition?: google.maps.LatLngLiteral | null;
  routePoints?: RoutePoint[];
  isRecording?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  isDemoMode?: boolean;
  isEditMode?: boolean;
  onPointDrag?: (index: number, lat: number, lng: number) => void;
  onPointDelete?: (index: number) => void;
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
  isDemoMode = false,
  isEditMode = false,
  onPointDrag,
  onPointDelete,
  onRouteLineClick,
  onDragStart,
  onDragEnd,
  allRoutes = [],
  visibleRoutes = new Set(),
  selectedRouteId,
  onRouteSelect,
  currentLocationMarker,
  onCurrentLocationFadeComplete,
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
  const prevModeRef = useRef<{ isEditMode: boolean; isDemoMode: boolean }>({
    isEditMode: false,
    isDemoMode: false,
  });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const prevVisibleRoutesRef = useRef<Set<string>>(visibleRoutes);

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

  // ズーム変更イベントリスナーを管理
  useEffect(() => {
    if (mapRef.current) {
      // 既存のリスナーをクリア
      if (zoomListenerRef.current) {
        google.maps.event.removeListener(zoomListenerRef.current);
      }

      // ズーム変更イベントリスナーを追加
      zoomListenerRef.current = mapRef.current.addListener("zoom_changed", () => {
        // ズーム変更時にマーカーを再描画（全モードで実行）
        if (routeMarkersRef.current.length > 0 || allRoutesMarkersRef.current.length > 0) {
          // マーカーをクリアして再作成をトリガー
          setTimeout(() => {
            setZoomTrigger((prev) => prev + 1);
          }, 100);
        }
      });

      return () => {
        if (zoomListenerRef.current) {
          google.maps.event.removeListener(zoomListenerRef.current);
        }
      };
    }
  }, [isEditMode, isDemoMode]);

  // 地図クリックイベントを別のuseEffectで管理
  useEffect(() => {
    if (mapRef.current && (isDemoMode || isEditMode) && onMapClick) {
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
  }, [isDemoMode, isEditMode, onMapClick]);

  // ユーザー位置でマップの中心を移動
  useEffect(() => {
    if (
      mapRef.current &&
      userPosition &&
      !isRecording &&
      !isEditMode &&
      !isDemoMode &&
      !selectedRouteId &&
      visibleRoutes.size === 0
    ) {
      mapRef.current.panTo(userPosition);
    }
  }, [userPosition, isRecording, isEditMode, isDemoMode, selectedRouteId, visibleRoutes]);

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
      !isDemoMode
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
  }, [routePoints, visibleRoutes, selectedRouteId, isEditMode, isDemoMode]);

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
        });
      }

      // 編集モード時にポリラインクリックでピン挿入（常に追加し直す）
      if (routePolylineRef.current) {
        // 既存のリスナーをクリア
        google.maps.event.clearListeners(routePolylineRef.current, "click");

        if ((isEditMode || isDemoMode) && onRouteLineClick) {
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

      // 記録中・編集中・個別表示の場合、線の色を更新
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
  }, [routePoints, isRecording, isEditMode, onRouteLineClick]);

  // 最新の関数をRefで保持（useEffect削除）
  const onPointDragRef = useRef(onPointDrag);
  const onPointDeleteRef = useRef(onPointDelete);
  onPointDragRef.current = onPointDrag;
  onPointDeleteRef.current = onPointDelete;

  // ルートポイントマーカーの描画（編集モード、手動作成モード、または個別ルート表示時）
  useEffect(() => {
    // 表示すべき状態かチェック（全ルート表示時は個別ルートのピン・ラベルを非表示）
    const shouldShowMarkersAndLabels =
      (isEditMode || isDemoMode || routePoints.length > 0) && visibleRoutes.size === 0;

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
      prevModeRef.current.isDemoMode !== isDemoMode;
    const needsRedraw = routeMarkersRef.current.length !== routePoints.length || modeChanged;

    // 現在のモードを記録
    prevModeRef.current = { isEditMode, isDemoMode };

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

          distanceLabelsRef.current[index].setPosition({
            lat: point.lat + 0.00008, // ピンが小さくなったので距離を調整
            lng: point.lng,
          });

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
            anchor: new google.maps.Point(30, 25),
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
        if (isEditMode || isDemoMode) {
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
              : isEditMode
              ? "#FF8C00"
              : isDemoMode
              ? "#17a2b8"
              : "#0000FF",
            fillOpacity: 0.9,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
          optimized: false,
          zIndex: -100,
        });

        let longTapTimer: NodeJS.Timeout | null = null;
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
          if (!isEditMode && !isDemoMode) return;

          // 左クリック（button 0）またはタッチ
          if (e.domEvent && (e.domEvent.button === 0 || e.domEvent.type === "touchstart")) {
            // イベントの伝播と デフォルト動作を完全に停止
            e.stop();
            if (e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
              e.domEvent.stopImmediatePropagation();
            }

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

            // 即座にドラッグモード開始
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

            // 即座に手動ドラッグを開始
            isManuallyDragging = true;

            // 1秒後（1000ms）で削除処理
            longTapTimer = setTimeout(() => {
              // 1秒間ロングタップで削除
              const currentOnPointDelete = (window as any).currentOnPointDelete;
              if (currentOnPointDelete) {
                console.log("1 second long tap detected - deleting pin", index);
                currentOnPointDelete(index);
              }
            }, 1000); // 1000ms
          }
        };

        // グローバルなマウス/タッチムーブ処理（ロングタップ後のドラッグ用）
        const handleGlobalMouseMove = (e: MouseEvent) => {
          if (dragModeActive && isManuallyDragging && mapRef.current) {
            // 実際にドラッグが開始されたら削除タイマーをクリア
            if (longTapTimer) {
              clearTimeout(longTapTimer);
              longTapTimer = null;
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
          if (dragModeActive && isManuallyDragging && mapRef.current && e.touches.length > 0) {
            // 実際にドラッグが開始されたら削除タイマーをクリア
            if (longTapTimer) {
              clearTimeout(longTapTimer);
              longTapTimer = null;
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
          if (!isEditMode && !isDemoMode) return;

          // ドラッグモード中はクリックを無視
          if (dragModeActive || isDraggingRef.current) {
            e.stop();
            if (e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
            }
            return;
          }
        });

        // マーカーのネイティブドラッグイベント
        marker.addListener("drag", (e: google.maps.MapMouseEvent) => {
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
          if (isEditMode || isDemoMode) {
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

        const distanceLabel = new google.maps.Marker({
          position: {
            lat: point.lat + 0.00008, // ピンが小さくなったので距離を調整
            lng: point.lng,
          },
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
            anchor: new google.maps.Point(30, 25), // 中心点を調整
          },
          zIndex: 50,
        });

        distanceLabelsRef.current.push(distanceLabel);
      });
    }
  }, [routePoints, isEditMode, isDemoMode, visibleRoutes, zoomTrigger]);

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

          // 選択ルートはハイライト、その他はより見やすく表示
          const routeOpacity = isSelected ? 1.0 : 0.6;
          const routeWeight = isSelected ? 4 : 3;
          const routeColor = isSelected ? "#0000FF" : "#666666";

          // ポリライン作成
          const polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: routeColor,
            strokeOpacity: routeOpacity,
            strokeWeight: routeWeight,
            map: mapRef.current,
          });

          // ポリラインクリックでルートを選択
          polyline.addListener("click", () => {
            if (onRouteSelect) {
              onRouteSelect(route);
            }
          });

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
            // 選択ルートは全ピン表示
            if (isSelected) {
              return path.map((_, index) => index);
            }

            let targetInterval: number = 1000; // 非選択ルートは1000m間隔

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

          displayIndices.forEach((pointIndex) => {
            const point = path[pointIndex];

            const isStart = pointIndex === 0;
            const isEnd = pointIndex === path.length - 1;

            // ピン作成（間引き表示でパフォーマンス改善）
            const marker = new google.maps.Marker({
              position: point,
              map: mapRef.current!,
              title: `${route.name} - ${
                isStart ? "スタート" : isEnd ? "ゴール" : `ポイント ${pointIndex + 1}`
              }`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? (isStart || isEnd ? 8 : 6) : isStart || isEnd ? 6 : 4,
                fillColor: isStart
                  ? "#28a745"
                  : isEnd
                  ? "#dc3545"
                  : isSelected
                  ? "#0000FF"
                  : "#666666",
                fillOpacity: isSelected ? 0.9 : 0.7,
                strokeColor: "#FFFFFF",
                strokeWeight: isSelected ? 2 : 1.5,
              },
              optimized: false,
              zIndex: -100,
            });

            allRoutesMarkersRef.current.push(marker);

            // 距離ラベル作成（選択・非選択ルート共に表示）
            const distanceLabel = new google.maps.Marker({
              position: {
                lat: point.lat + (isSelected ? 0.00008 : 0.00006),
                lng: point.lng,
              },
              map: mapRef.current!,
              icon: {
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="60" height="${
                    isSelected ? 20 : 16
                  }" viewBox="0 0 60 ${isSelected ? 20 : 16}">
                    <rect x="0" y="0" width="60" height="${isSelected ? 20 : 16}" rx="${
                  isSelected ? 10 : 8
                }" fill="${isSelected ? "rgba(0,0,0,0.8)" : "rgba(102,102,102,0.8)"}" stroke="${
                  isSelected ? "white" : "#ddd"
                }" stroke-width="1"/>
                    <text x="30" y="${isSelected ? 14 : 11}" text-anchor="middle" fill="${
                  isSelected ? "white" : "white"
                }" font-family="Arial" font-size="${isSelected ? 12 : 10}" font-weight="bold">
                      ${formatDistance(cumulativeDistances[pointIndex])}
                    </text>
                  </svg>
                `)}`,
                scaledSize: new google.maps.Size(60, isSelected ? 20 : 16),
                anchor: new google.maps.Point(30, isSelected ? 25 : 20),
              },
              zIndex: isSelected ? 300 : 250 + routeIndex,
            });

            allRoutesLabelsRef.current.push(distanceLabel);
          });
        }
      });

      // 全ルート表示時のマップ移動は無効化
      // ユーザーが手動で表示範囲を調整できるように変更
    }
  }, [visibleRoutes, allRoutes, selectedRouteId, zoomTrigger]);

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
  isDemoMode?: boolean;
  isEditMode?: boolean;
  onPointDrag?: (index: number, lat: number, lng: number) => void;
  onPointDelete?: (index: number) => void;
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
  isDemoMode,
  isEditMode,
  onPointDrag,
  onPointDelete,
  onRouteLineClick,
  onDragStart,
  onDragEnd,
  allRoutes,
  visibleRoutes,
  selectedRouteId,
  onRouteSelect,
  currentLocationMarker,
  onCurrentLocationFadeComplete,
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
            isDemoMode={isDemoMode}
            isEditMode={isEditMode}
            onPointDrag={onPointDrag}
            onPointDelete={onPointDelete}
            onRouteLineClick={onRouteLineClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            allRoutes={allRoutes}
            visibleRoutes={visibleRoutes}
            selectedRouteId={selectedRouteId}
            onRouteSelect={onRouteSelect}
            currentLocationMarker={currentLocationMarker}
            onCurrentLocationFadeComplete={onCurrentLocationFadeComplete}
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
        isDemoMode={isDemoMode}
        isEditMode={isEditMode}
        onPointDrag={onPointDrag}
        onPointDelete={onPointDelete}
        onRouteLineClick={onRouteLineClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        allRoutes={allRoutes}
        visibleRoutes={visibleRoutes}
        selectedRouteId={selectedRouteId}
        onRouteSelect={onRouteSelect}
        currentLocationMarker={currentLocationMarker}
        onCurrentLocationFadeComplete={onCurrentLocationFadeComplete}
      />
    </Wrapper>
  );
};

export default GoogleMap;
