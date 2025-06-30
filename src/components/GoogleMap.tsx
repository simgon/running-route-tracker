import React, { useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import { RoutePoint } from "../hooks/useRunningRoute";
import { RunningRoute } from "../lib/supabase";

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
  showAllRoutes?: boolean;
  selectedRouteId?: string;
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
  showAllRoutes = false,
  selectedRouteId,
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
      });

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

  // ユーザー位置マーカーの更新（現在位置アイコンは非表示）
  useEffect(() => {
    if (mapRef.current && userPosition) {
      // 現在位置マーカーは表示しない
      // if (userMarkerRef.current) {
      //   // 既存マーカーの位置を更新
      //   userMarkerRef.current.setPosition(userPosition);
      // } else {
      //   // 新しいマーカーを作成
      //   userMarkerRef.current = new google.maps.Marker({
      //     position: userPosition,
      //     map: mapRef.current,
      //     title: "現在位置",
      //     icon: {
      //       path: google.maps.SymbolPath.CIRCLE,
      //       scale: 8,
      //       fillColor: "#4285F4",
      //       fillOpacity: 1,
      //       strokeColor: "#ffffff",
      //       strokeWeight: 2,
      //     },
      //   });
      // }

      // 記録中でない場合かつ編集・手動作成モードでない場合のみマップの中心を移動
      if (!isRecording && !isEditMode && !isDemoMode) {
        mapRef.current.panTo(userPosition);
      }
    }
  }, [userPosition, isRecording, isEditMode, isDemoMode]);

  // ルート変更時の地図位置調整（編集モード・手動作成モード時は無効）
  useEffect(() => {
    if (mapRef.current && routePoints.length > 0 && !showAllRoutes && !isEditMode && !isDemoMode) {
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
  }, [routePoints, showAllRoutes, selectedRouteId, isEditMode, isDemoMode]); // isEditModeとisDemoModeを依存配列に追加

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

  // 最新の関数を保持
  useEffect(() => {
    (window as any).currentOnPointDrag = onPointDrag;
    (window as any).currentOnPointDelete = onPointDelete;
  }, [onPointDrag, onPointDelete]);

  // ルートポイントマーカーの描画（編集モード、手動作成モード、または個別ルート表示時）
  useEffect(() => {
    // 表示すべき状態かチェック（全ルート表示時は個別ルートのピン・ラベルを非表示）
    const shouldShowMarkersAndLabels =
      (isEditMode || isDemoMode || routePoints.length > 0) && !showAllRoutes;

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
      routePoints.forEach((point, index) => {
        const isStart = index === 0;
        const isEnd = index === routePoints.length - 1;

        const marker = new google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: mapRef.current!,
          draggable: false, // 標準ドラッグを無効化
          title: `${isStart ? "スタート" : isEnd ? "ゴール" : `ポイント ${index + 1}`}${
            isEditMode ? " (ドラッグ: 移動, 右クリック: 削除)" : ""
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
          zIndex: -1,
        });

        let isDragging = false;
        let longTapTimer: NodeJS.Timeout | null = null;
        let touchStartTime = 0;
        let dragModeActive = false; // ドラッグモードの状態を管理

        // グローバルイベントリスナーを使用
        let mouseMoveListener: google.maps.MapsEventListener | null = null;
        let mouseUpListener: google.maps.MapsEventListener | null = null;
        let touchMoveListener: google.maps.MapsEventListener | null = null;
        let touchEndListener: google.maps.MapsEventListener | null = null;

        const startDrag = () => {
          if (!mapRef.current) return;

          // マウスムーブリスナー
          mouseMoveListener = mapRef.current.addListener(
            "mousemove",
            (e: google.maps.MapMouseEvent) => {
              if (isDragging && e.latLng) {
                marker.setPosition(e.latLng);
                // 最新のonPointDrag関数を使用
                const currentOnPointDrag = (window as any).currentOnPointDrag;
                if (currentOnPointDrag) {
                  currentOnPointDrag(index, e.latLng.lat(), e.latLng.lng());
                }
              }
            }
          );

          // タッチムーブリスナー
          touchMoveListener = mapRef.current.addListener(
            "touchmove",
            (e: google.maps.MapMouseEvent) => {
              if (isDragging && e.latLng) {
                marker.setPosition(e.latLng);
                // 最新のonPointDrag関数を使用
                const currentOnPointDrag = (window as any).currentOnPointDrag;
                if (currentOnPointDrag) {
                  currentOnPointDrag(index, e.latLng.lat(), e.latLng.lng());
                }
              }
            }
          );

          // タッチエンドリスナー
          touchEndListener = mapRef.current.addListener(
            "touchend",
            (upEvent: google.maps.MapMouseEvent) => {
              if (isDragging) {
                isDragging = false;

                // 実際にドラッグが発生したかを判定
                let actuallyDragged = false;
                if (dragStartPositionRef.current && upEvent.domEvent) {
                  const touchEvent = upEvent.domEvent as TouchEvent;
                  if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
                    const touch = touchEvent.changedTouches[0];
                    const deltaX = Math.abs(touch.clientX - dragStartPositionRef.current.x);
                    const deltaY = Math.abs(touch.clientY - dragStartPositionRef.current.y);
                    actuallyDragged = deltaX > 10 || deltaY > 10;
                  }
                }

                if (actuallyDragged) {
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 300);
                } else {
                  isDraggingRef.current = false;
                }

                if (onDragEnd) {
                  onDragEnd();
                }

                dragStartPositionRef.current = null;

                // マーカーの色を元に戻す
                marker.setIcon({
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isStart || isEnd ? 8 : 6,
                  fillColor: isStart ? "#28a745" : isEnd ? "#dc3545" : "#FF8C00",
                  fillOpacity: 0.9,
                  strokeColor: "#FFFFFF",
                  strokeWeight: 2,
                });

                if (mapRef.current) {
                  mapRef.current.setOptions({ draggable: true });
                }

                // イベントリスナーをクリーンアップ
                if (mouseMoveListener) {
                  google.maps.event.removeListener(mouseMoveListener);
                  mouseMoveListener = null;
                }
                if (mouseUpListener) {
                  google.maps.event.removeListener(mouseUpListener);
                  mouseUpListener = null;
                }
                if (touchMoveListener) {
                  google.maps.event.removeListener(touchMoveListener);
                  touchMoveListener = null;
                }
                if (touchEndListener) {
                  google.maps.event.removeListener(touchEndListener);
                  touchEndListener = null;
                }
              }
            }
          );

          // マウスアップリスナー
          mouseUpListener = mapRef.current.addListener(
            "mouseup",
            (upEvent: google.maps.MapMouseEvent) => {
              if (isDragging) {
                isDragging = false;

                // 実際にドラッグが発生したかを判定（10px以上移動した場合をドラッグとみなす）
                let actuallyDragged = false;
                if (dragStartPositionRef.current && upEvent.domEvent) {
                  const mouseEvent = upEvent.domEvent as MouseEvent;
                  const deltaX = Math.abs(mouseEvent.clientX - dragStartPositionRef.current.x);
                  const deltaY = Math.abs(mouseEvent.clientY - dragStartPositionRef.current.y);
                  actuallyDragged = deltaX > 10 || deltaY > 10;
                  console.log(
                    "Map mouseup - movement delta:",
                    deltaX,
                    deltaY,
                    "actuallyDragged:",
                    actuallyDragged
                  );
                }

                // ドラッグが実際に発生した場合のみ遅延を設定
                if (actuallyDragged) {
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 300); // 300msに調整
                } else {
                  // 単純なクリックの場合は即座にリセット
                  isDraggingRef.current = false;
                }

                // ドラッグ終了コールバック
                if (onDragEnd) {
                  onDragEnd();
                }

                // ドラッグ開始位置をリセット
                dragStartPositionRef.current = null;

                // マーカーの色を元に戻す
                marker.setIcon({
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isStart || isEnd ? 8 : 6,
                  fillColor: isStart ? "#28a745" : isEnd ? "#dc3545" : "#FF8C00",
                  fillOpacity: 0.9,
                  strokeColor: "#FFFFFF",
                  strokeWeight: 2,
                });

                if (mapRef.current) {
                  mapRef.current.setOptions({ draggable: true }); // 地図のドラッグを再有効化
                }

                // イベントリスナーをクリーンアップ
                if (mouseMoveListener) {
                  google.maps.event.removeListener(mouseMoveListener);
                  mouseMoveListener = null;
                }
                if (mouseUpListener) {
                  google.maps.event.removeListener(mouseUpListener);
                  mouseUpListener = null;
                }
              }
            }
          );

          // ドキュメント全体でもマウスアップを監視（マップ外でマウスを離した場合）
          const documentMouseUp = (upEvent: MouseEvent) => {
            if (isDragging) {
              isDragging = false;

              // 実際にドラッグが発生したかを判定（10px以上移動した場合をドラッグとみなす）
              let actuallyDragged = false;
              if (dragStartPositionRef.current) {
                const deltaX = Math.abs(upEvent.clientX - dragStartPositionRef.current.x);
                const deltaY = Math.abs(upEvent.clientY - dragStartPositionRef.current.y);
                actuallyDragged = deltaX > 10 || deltaY > 10;
                console.log(
                  "Document mouseup - movement delta:",
                  deltaX,
                  deltaY,
                  "actuallyDragged:",
                  actuallyDragged
                );
              }

              // ドラッグが実際に発生した場合のみ遅延を設定
              if (actuallyDragged) {
                setTimeout(() => {
                  isDraggingRef.current = false;
                }, 300); // 300msに調整
              } else {
                // 単純なクリックの場合は即座にリセット
                isDraggingRef.current = false;
              }

              // ドラッグ終了コールバック
              if (onDragEnd) {
                onDragEnd();
              }

              // ドラッグ開始位置をリセット
              dragStartPositionRef.current = null;

              // マーカーの色を元に戻す
              marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: isStart || isEnd ? 8 : 6,
                fillColor: isStart ? "#28a745" : isEnd ? "#dc3545" : "#FF8C00",
                fillOpacity: 0.9,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
              });

              if (mapRef.current) {
                mapRef.current.setOptions({ draggable: true });
              }

              // イベントリスナーをクリーンアップ
              if (mouseMoveListener) {
                google.maps.event.removeListener(mouseMoveListener);
                mouseMoveListener = null;
              }
              if (mouseUpListener) {
                google.maps.event.removeListener(mouseUpListener);
                mouseUpListener = null;
              }
              if (touchMoveListener) {
                google.maps.event.removeListener(touchMoveListener);
                touchMoveListener = null;
              }
              if (touchEndListener) {
                google.maps.event.removeListener(touchEndListener);
                touchEndListener = null;
              }

              document.removeEventListener("mouseup", documentMouseUp);
            }
          };

          document.addEventListener("mouseup", documentMouseUp);
        };

        // マウス/タッチダウンでロングタップ検出とドラッグ準備
        const handleMouseDown = (e: any) => {
          // 編集モード・手動作成モードでない場合は無効化
          if (!isEditMode && !isDemoMode) return;

          // 左クリック（button 0）またはタッチ
          if (e.domEvent && (e.domEvent.button === 0 || e.domEvent.type === 'touchstart')) {
            e.stop();
            e.domEvent.stopPropagation();
            e.domEvent.preventDefault();
            
            touchStartTime = Date.now();
            
            // ドラッグ開始位置を記録
            dragStartPositionRef.current = {
              x: e.domEvent.clientX || (e.domEvent.touches && e.domEvent.touches[0].clientX),
              y: e.domEvent.clientY || (e.domEvent.touches && e.domEvent.touches[0].clientY),
            };

            // ロングタップ検出（500ms）
            longTapTimer = setTimeout(() => {
              // ロングタップでドラッグモード開始
              dragModeActive = true;
              isDragging = true;
              isDraggingRef.current = true;

              // ドラッグ開始コールバック
              if (onDragStart) {
                onDragStart();
              }

              // マーカーの色を変更してドラッグモード中を示す
              marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: isStart || isEnd ? 10 : 8,
                fillColor: "#FF69B4",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
              });

              if (mapRef.current) {
                mapRef.current.setOptions({ draggable: false });
              }

              startDrag();
            }, 500);
          }
        };

        // マウスアップ/タッチエンドでロングタップタイマーをクリア
        const handleMouseUp = (e: any) => {
          if (longTapTimer) {
            clearTimeout(longTapTimer);
            longTapTimer = null;
          }
          
          // ドラッグモードがアクティブでない場合のみクリック処理
          if (!dragModeActive) {
            const clickDuration = Date.now() - touchStartTime;
            // 短いタップ（500ms未満）の場合のみクリック処理を継続
            if (clickDuration < 500) {
              // 通常のクリック処理（ダブルタップ検出用）
              // この処理はclickイベントで行う
            }
          } else {
            // ドラッグモード終了
            dragModeActive = false;
          }
        };

        // ダブルタップで削除を実装
        let lastTapTime = 0;
        let tapCount = 0;
        
        marker.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!isEditMode && !isDemoMode) return;
          
          // ドラッグモード中はクリックを無視
          if (dragModeActive || isDragging) {
            return;
          }
          
          const currentTime = Date.now();
          const timeSinceLastTap = currentTime - lastTapTime;
          
          // 300ms以内の連続タップをダブルタップとして認識
          if (timeSinceLastTap < 300 && tapCount === 1) {
            // ダブルタップ検出
            e.stop();
            if (e.domEvent) {
              e.domEvent.stopPropagation();
              e.domEvent.preventDefault();
            }
            
            const currentOnPointDelete = (window as any).currentOnPointDelete;
            if (currentOnPointDelete) {
              console.log("Double tap detected - deleting pin", index);
              currentOnPointDelete(index);
            }
            
            // カウンターリセット
            tapCount = 0;
            lastTapTime = 0;
          } else {
            // 最初のタップまたは時間が空いたタップ
            tapCount = 1;
            lastTapTime = currentTime;
            
            // 300ms後にタップカウンターをリセット（ダブルタップが発生しなかった場合）
            setTimeout(() => {
              if (tapCount === 1 && Date.now() - lastTapTime >= 300) {
                tapCount = 0;
                lastTapTime = 0;
              }
            }, 300);
          }
        });

        marker.addListener("mousedown", handleMouseDown);
        marker.addListener("mouseup", handleMouseUp);
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
            const currentOnPointDelete = (window as any).currentOnPointDelete;
            if (currentOnPointDelete) {
              currentOnPointDelete(index);
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
  }, [routePoints, isEditMode, isDemoMode, showAllRoutes]);

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

    if (showAllRoutes && allRoutes.length > 0) {
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

      allRoutes.forEach((route, routeIndex) => {
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

          // ルート名を表示するInfoWindow
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="font-weight: bold; color: ${routeColor}">${route.name}</div>`,
            position: path[0], // スタート地点に表示
          });

          // ポリラインクリックでルート名を表示
          polyline.addListener("click", () => {
            infoWindow.open(mapRef.current);
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
            // ズームレベルに応じて表示間隔を調整
            const currentZoom = mapRef.current?.getZoom() || 15;
            let targetInterval: number;

            if (currentZoom >= 14) {
              targetInterval = 500; // 高ズーム時は500m間隔
            } else if (currentZoom >= 12) {
              targetInterval = 1000; // 中ズーム時は1000m間隔
            } else {
              targetInterval = 2000; // 低ズーム時は2000m間隔
            }

            // 選択ルートでも距離による間引きを適用（編集モード時は除く）
            // 編集モード時は全ポイント表示
            if (isSelected && (isEditMode || isDemoMode)) {
              return path.map((_, index) => index);
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
              zIndex: -1,
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
  }, [showAllRoutes, allRoutes, selectedRouteId]);

  return (
    <div
      ref={ref}
      style={style}
      onContextMenu={isEditMode ? (e) => e.preventDefault() : undefined}
    />
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
  showAllRoutes?: boolean;
  selectedRouteId?: string;
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
  showAllRoutes,
  selectedRouteId,
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
            showAllRoutes={showAllRoutes}
            selectedRouteId={selectedRouteId}
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
        showAllRoutes={showAllRoutes}
        selectedRouteId={selectedRouteId}
      />
    </Wrapper>
  );
};

export default GoogleMap;
