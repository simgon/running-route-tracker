import React, { useEffect, useState, useRef } from 'react';
import { styled, keyframes } from '@mui/material/styles';

interface CurrentLocationMarkerProps {
  position: { lat: number; lng: number };
  heading?: number; // 方向（度）
  map: google.maps.Map;
  onFadeComplete?: () => void;
}

const fadeOut = keyframes`
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8); }
`;

const MarkerContainer = styled('div')<{ $fadeOut: boolean }>`
  position: absolute;
  width: 60px;
  height: 60px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: ${({ $fadeOut }) => $fadeOut ? fadeOut : 'none'} 2s ease-in-out;
`;

const LocationCircle = styled('div')`
  width: 20px;
  height: 20px;
  background-color: #1976d2;
  border: 3px solid white;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 10px rgba(25, 118, 210, 0.5);
`;

const DirectionFan = styled('div')<{ $heading: number }>`
  width: 0;
  height: 0;
  border-left: 20px solid transparent;
  border-right: 20px solid transparent;
  border-bottom: 30px solid rgba(25, 118, 210, 0.3);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(${({ $heading }) => $heading - 90}deg);
  transform-origin: 50% 100%;
`;

const CurrentLocationMarker: React.FC<CurrentLocationMarkerProps> = ({
  position,
  heading = 0,
  map,
  onFadeComplete,
}) => {
  const [shouldFadeOut, setShouldFadeOut] = useState(false);
  const [pixelPosition, setPixelPosition] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    // Google Maps OverlayViewを使用して座標変換
    class CustomOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      
      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        // 何もしない（DOMは別で管理）
      }

      draw() {
        const projection = this.getProjection();
        if (projection) {
          const pixel = projection.fromLatLngToDivPixel(this.position);
          if (pixel) {
            setPixelPosition({ x: pixel.x, y: pixel.y });
          }
        }
      }

      onRemove() {
        // 何もしない
      }
    }

    const latLng = new google.maps.LatLng(position.lat, position.lng);
    const overlay = new CustomOverlay(latLng);
    overlay.setMap(map);
    overlayRef.current = overlay;

    // マップの移動やズーム時の再描画リスナー
    const updatePosition = () => {
      overlay.draw();
    };

    const listeners = [
      google.maps.event.addListener(map, 'center_changed', updatePosition),
      google.maps.event.addListener(map, 'zoom_changed', updatePosition),
      google.maps.event.addListener(map, 'bounds_changed', updatePosition),
    ];

    return () => {
      listeners.forEach(listener => google.maps.event.removeListener(listener));
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
      }
    };
  }, [position, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldFadeOut(true);
      if (onFadeComplete) {
        setTimeout(onFadeComplete, 2000); // フェードアウト完了後に呼び出し
      }
    }, 8000); // 8秒後にフェードアウト開始

    return () => clearTimeout(timer);
  }, [onFadeComplete]);

  if (!pixelPosition) {
    return null;
  }

  return (
    <MarkerContainer 
      $fadeOut={shouldFadeOut}
      style={{
        left: pixelPosition.x,
        top: pixelPosition.y,
        zIndex: 1000,
      }}
    >
      <DirectionFan $heading={heading} />
      <LocationCircle />
    </MarkerContainer>
  );
};

export default CurrentLocationMarker;