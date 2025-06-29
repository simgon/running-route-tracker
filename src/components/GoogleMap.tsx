import React, { useEffect, useRef } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { RoutePoint } from '../hooks/useRunningRoute';

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
  onRouteLineClick
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const distanceLabelsRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (ref.current && !mapRef.current) {
      mapRef.current = new google.maps.Map(ref.current, {
        center,
        zoom,
        mapTypeId: 'roadmap',
        // ランニングアプリに適した設定
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        streetViewControl: true,
        rotateControl: true,
        fullscreenControl: true,
        // 地形情報を表示
        mapTypeControlOptions: {
          mapTypeIds: ['roadmap', 'terrain', 'satellite', 'hybrid']
        },
        // 店舗などの情報ウィンドウを無効化
        clickableIcons: false,
        // 編集モード時の右クリックメニューを無効化
        disableDoubleClickZoom: false
      });

      // 編集モード時に右クリックコンテキストメニューを無効化
      if (isEditMode) {
        mapRef.current.addListener('rightclick', (e: google.maps.MapMouseEvent) => {
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
      const clickListener = mapRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          onMapClick(lat, lng);
        }
      });

      // クリーンアップ関数でリスナーを削除
      return () => {
        google.maps.event.removeListener(clickListener);
      };
    }
  }, [isDemoMode, isEditMode, onMapClick]);

  // ユーザー位置マーカーの更新
  useEffect(() => {
    if (mapRef.current && userPosition) {
      if (userMarkerRef.current) {
        // 既存マーカーの位置を更新
        userMarkerRef.current.setPosition(userPosition);
      } else {
        // 新しいマーカーを作成
        userMarkerRef.current = new google.maps.Marker({
          position: userPosition,
          map: mapRef.current,
          title: '現在位置',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });
      }

      // 記録中でない場合のみマップの中心を移動
      if (!isRecording) {
        mapRef.current.panTo(userPosition);
      }
    }
  }, [userPosition, isRecording]);

  // ランニングルートの描画
  useEffect(() => {
    if (mapRef.current && routePoints.length > 0) {
      const path = routePoints.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));

      if (routePolylineRef.current) {
        // 既存のポリラインを更新
        routePolylineRef.current.setPath(path);
      } else {
        // 新しいポリラインを作成
        routePolylineRef.current = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: isRecording ? '#FF0000' : isEditMode ? '#FF8C00' : '#0000FF',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map: mapRef.current
        });
      }

      // 編集モード時にポリラインクリックでピン挿入（常に追加し直す）
      if (routePolylineRef.current) {
        // 既存のリスナーをクリア
        google.maps.event.clearListeners(routePolylineRef.current, 'click');
        
        if (isEditMode && onRouteLineClick) {
          routePolylineRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              onRouteLineClick(lat, lng);
            }
          });
        }
      }

      // 記録中・編集中の場合、線の色を更新
      if (routePolylineRef.current) {
        routePolylineRef.current.setOptions({
          strokeColor: isRecording ? '#FF0000' : isEditMode ? '#FF8C00' : '#0000FF'
        });
      }
    } else if (routePolylineRef.current) {
      // ルートがない場合はポリラインを削除
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, [routePoints, isRecording, isEditMode, onRouteLineClick]);

  // ルートポイントマーカーの描画（編集モード）
  useEffect(() => {
    // 編集モードでない場合は既存マーカーをクリア
    if (!isEditMode) {
      routeMarkersRef.current.forEach(marker => marker.setMap(null));
      routeMarkersRef.current = [];
      distanceLabelsRef.current.forEach(label => label.setMap(null));
      distanceLabelsRef.current = [];
      return;
    }

    // 距離計算関数
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000; // 地球の半径（メートル）
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // 累積距離計算
    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < routePoints.length; i++) {
      const distance = calculateDistance(
        routePoints[i-1].lat, routePoints[i-1].lng,
        routePoints[i].lat, routePoints[i].lng
      );
      cumulativeDistances.push(cumulativeDistances[i-1] + distance);
    }

    // ポイント数が変わった場合のみ再描画
    if (routeMarkersRef.current.length !== routePoints.length) {
      // 既存のマーカーをクリア
      routeMarkersRef.current.forEach(marker => marker.setMap(null));
      routeMarkersRef.current = [];
      distanceLabelsRef.current.forEach(label => label.setMap(null));
      distanceLabelsRef.current = [];
    } else {
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
            lng: point.lng 
          });

          // 距離ラベルのアイコンも更新
          distanceLabelsRef.current[index].setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20">
                <rect x="0" y="0" width="80" height="20" rx="10" fill="rgba(0,0,0,0.7)" stroke="white" stroke-width="1"/>
                <text x="40" y="14" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">
                  ${formatDistance(cumulativeDistances[index])}
                </text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(80, 20),
            anchor: new google.maps.Point(40, 25)
          });
        }
      });
      return;
    }

    if (mapRef.current && isEditMode && routePoints.length > 0 && onPointDrag) {
      routePoints.forEach((point, index) => {
        const isStart = index === 0;
        const isEnd = index === routePoints.length - 1;
        
        const marker = new google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: mapRef.current!,
          draggable: false, // 標準ドラッグを無効化
          title: `${isStart ? 'スタート' : isEnd ? 'ゴール' : `ポイント ${index + 1}`} (ドラッグ: 移動, 右クリック: 削除)`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isStart || isEnd ? 8 : 6, // 小さくする
            fillColor: isStart ? '#28a745' : isEnd ? '#dc3545' : '#FF8C00',
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
          },
          optimized: false
        });

        let isDragging = false;

        // グローバルイベントリスナーを使用
        let mouseMoveListener: google.maps.MapsEventListener | null = null;
        let mouseUpListener: google.maps.MapsEventListener | null = null;

        const startDrag = () => {
          if (!mapRef.current) return;

          // マウスムーブリスナー
          mouseMoveListener = mapRef.current.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
            if (isDragging && e.latLng && onPointDrag) {
              marker.setPosition(e.latLng);
              onPointDrag(index, e.latLng.lat(), e.latLng.lng());
            }
          });

          // マウスアップリスナー
          mouseUpListener = mapRef.current.addListener('mouseup', () => {
            if (isDragging) {
              isDragging = false;
              
              // マーカーの色を元に戻す
              marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: isStart || isEnd ? 8 : 6,
                fillColor: isStart ? '#28a745' : isEnd ? '#dc3545' : '#FF8C00',
                fillOpacity: 0.9,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
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
          });

          // ドキュメント全体でもマウスアップを監視（マップ外でマウスを離した場合）
          const documentMouseUp = () => {
            if (isDragging) {
              isDragging = false;
              
              // マーカーの色を元に戻す
              marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                scale: isStart || isEnd ? 8 : 6,
                fillColor: isStart ? '#28a745' : isEnd ? '#dc3545' : '#FF8C00',
                fillOpacity: 0.9,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
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
              
              document.removeEventListener('mouseup', documentMouseUp);
            }
          };
          
          document.addEventListener('mouseup', documentMouseUp);
        };

        // 左クリックダウン時のみドラッグ開始
        const handleMouseDown = (e: any) => {
          // 左クリック（button 0）のみドラッグを開始
          if (e.domEvent && e.domEvent.button === 0) {
            e.stop();
            isDragging = true;
            
            // マーカーの色を変更してドラッグ中を示す
            marker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: isStart || isEnd ? 10 : 8, // ドラッグ中も小さく
              fillColor: '#FF69B4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2
            });

            if (mapRef.current) {
              mapRef.current.setOptions({ draggable: false });
            }

            startDrag();
          }
        };

        marker.addListener('mousedown', handleMouseDown);

        // 右クリックで削除
        marker.addListener('rightclick', (e: google.maps.MapMouseEvent) => {
          e.stop(); // イベント伝播を停止
          if (onPointDelete) {
            onPointDelete(index);
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
            lng: point.lng 
          },
          map: mapRef.current!,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="20" viewBox="0 0 80 20">
                <rect x="0" y="0" width="80" height="20" rx="10" fill="rgba(0,0,0,0.7)" stroke="white" stroke-width="1"/>
                <text x="40" y="14" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">
                  ${formatDistance(cumulativeDistances[index])}
                </text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(80, 20),
            anchor: new google.maps.Point(40, 25) // ピンが小さくなったので調整
          },
          zIndex: 1000
        });

        distanceLabelsRef.current.push(distanceLabel);
      });
    }
  }, [routePoints, isEditMode, onPointDrag, onPointDelete]);

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
  onRouteLineClick
}) => {
  const render = (status: any) => {
    switch (status) {
      case 'LOADING':
        return <div>マップを読み込み中...</div>;
      case 'FAILURE':
        return <div>マップの読み込みに失敗しました</div>;
      case 'SUCCESS':
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
      />
    </Wrapper>
  );
};

export default GoogleMap;