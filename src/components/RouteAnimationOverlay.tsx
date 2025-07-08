import React, { useEffect, useRef, useState } from 'react';
import { RoutePoint } from '../hooks/useRunningRoute';

interface RouteAnimationOverlayProps {
  map: google.maps.Map;
  routePoints: RoutePoint[];
  isAnimating: boolean;
  animationType: 'draw' | 'pulse' | 'flash' | 'none';
  animationSpeed?: number; // milliseconds per point
  onAnimationComplete?: () => void;
  color?: string;
  lineWidth?: number;
}

export const RouteAnimationOverlay: React.FC<RouteAnimationOverlayProps> = ({
  map,
  routePoints,
  isAnimating,
  animationType,
  animationSpeed = 100,
  onAnimationComplete,
  color = '#FF4444',
  lineWidth = 4,
}) => {
  // const [animatedPoints, setAnimatedPoints] = useState<RoutePoint[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // アニメーションをクリーンアップ
  const cleanupAnimation = () => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  // ルート描画アニメーション
  const startDrawAnimation = () => {
    if (!routePoints.length) return;

    cleanupAnimation();
    // setAnimatedPoints([]);

    let currentIndex = 0;
    const animateStep = () => {
      if (currentIndex >= routePoints.length) {
        onAnimationComplete?.();
        return;
      }

      const newPoints = routePoints.slice(0, currentIndex + 1);
      // setAnimatedPoints(newPoints);

      // ポリライン更新
      if (polylineRef.current) {
        polylineRef.current.setPath(newPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      } else {
        polylineRef.current = new google.maps.Polyline({
          path: newPoints.map(p => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: lineWidth,
          map: map,
          zIndex: 1000,
        });
      }

      // 現在のポイントにマーカーを追加（アニメーション効果付き）
      if (currentIndex < routePoints.length) {
        const point = routePoints[currentIndex];
        const marker = new google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          animation: google.maps.Animation.DROP,
          zIndex: 1001,
        });

        markersRef.current.push(marker);

        // マーカーのパルス効果
        setTimeout(() => {
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: color,
            fillOpacity: 0.7,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          });
        }, 200);
      }

      currentIndex++;
      animationRef.current = setTimeout(animateStep, animationSpeed);
    };

    animateStep();
  };

  // パルスアニメーション
  const startPulseAnimation = () => {
    if (!routePoints.length) return;

    cleanupAnimation();

    // 全ルートを一度に表示
    polylineRef.current = new google.maps.Polyline({
      path: routePoints.map(p => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: lineWidth,
      map: map,
      zIndex: 1000,
    });

    // パルス効果
    let pulseCount = 0;
    const maxPulses = 3;
    const pulseInterval = 600;

    const pulse = () => {
      if (pulseCount >= maxPulses) {
        onAnimationComplete?.();
        return;
      }

      if (polylineRef.current) {
        // 拡大
        polylineRef.current.setOptions({
          strokeWeight: lineWidth + 4,
          strokeOpacity: 1.0,
        });

        setTimeout(() => {
          if (polylineRef.current) {
            // 縮小
            polylineRef.current.setOptions({
              strokeWeight: lineWidth,
              strokeOpacity: 0.8,
            });
          }
        }, pulseInterval / 2);
      }

      pulseCount++;
      animationRef.current = setTimeout(pulse, pulseInterval);
    };

    pulse();
  };

  // フラッシュアニメーション
  const startFlashAnimation = () => {
    if (!routePoints.length) return;

    cleanupAnimation();

    // 全ルートを表示
    polylineRef.current = new google.maps.Polyline({
      path: routePoints.map(p => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: lineWidth,
      map: map,
      zIndex: 1000,
    });

    // フラッシュ効果
    let flashCount = 0;
    const maxFlashes = 5;
    const flashInterval = 200;

    const flash = () => {
      if (flashCount >= maxFlashes) {
        onAnimationComplete?.();
        return;
      }

      if (polylineRef.current) {
        const isVisible = flashCount % 2 === 0;
        polylineRef.current.setOptions({
          strokeOpacity: isVisible ? 1.0 : 0.2,
        });
      }

      flashCount++;
      animationRef.current = setTimeout(flash, flashInterval);
    };

    flash();
  };

  // アニメーション開始
  useEffect(() => {
    if (!isAnimating || animationType === 'none') {
      cleanupAnimation();
      return;
    }

    switch (animationType) {
      case 'draw':
        startDrawAnimation();
        break;
      case 'pulse':
        startPulseAnimation();
        break;
      case 'flash':
        startFlashAnimation();
        break;
    }

    return cleanupAnimation;
  }, [isAnimating, animationType, routePoints, map]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return cleanupAnimation;
  }, []);

  return null; // このコンポーネントは視覚的な要素を返さない
};

export default RouteAnimationOverlay;