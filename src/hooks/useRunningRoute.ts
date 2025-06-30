import { useState, useRef } from 'react';
import { CustomGeolocationPosition } from './useGeolocation';

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

export interface RunningRouteState {
  isRecording: boolean;
  route: RoutePoint[];
  distance: number;
  startTime: number | null;
  duration: number;
}

export interface UseRunningRouteReturn {
  routeState: RunningRouteState;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRoute: () => void;
  addPoint: (position: CustomGeolocationPosition) => void;
}

// 2点間の距離を計算（Haversine公式）
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

export const useRunningRoute = (): UseRunningRouteReturn => {
  const [routeState, setRouteState] = useState<RunningRouteState>({
    isRecording: false,
    route: [],
    distance: 0,
    startTime: null,
    duration: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = () => {
    const now = Date.now();
    setRouteState(prev => ({
      ...prev,
      isRecording: true,
      startTime: now,
      route: [],
      distance: 0,
      duration: 0
    }));

    // 経過時間を更新するタイマー
    intervalRef.current = setInterval(() => {
      setRouteState(prev => ({
        ...prev,
        duration: prev.startTime ? Date.now() - prev.startTime : 0
      }));
    }, 1000);
  };

  const stopRecording = () => {
    setRouteState(prev => ({
      ...prev,
      isRecording: false
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pauseRecording = () => {
    setRouteState(prev => ({
      ...prev,
      isRecording: false
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resumeRecording = () => {
    setRouteState(prev => ({
      ...prev,
      isRecording: true
    }));

    // タイマーを再開
    intervalRef.current = setInterval(() => {
      setRouteState(prev => ({
        ...prev,
        duration: prev.startTime ? Date.now() - prev.startTime : 0
      }));
    }, 1000);
  };

  const clearRoute = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setRouteState({
      isRecording: false,
      route: [],
      distance: 0,
      startTime: null,
      duration: 0
    });
  };

  const addPoint = (position: CustomGeolocationPosition) => {
    if (!routeState.isRecording) return;

    const newPoint: RoutePoint = {
      lat: position.lat,
      lng: position.lng,
      timestamp: position.timestamp,
      accuracy: position.accuracy
    };

    setRouteState(prev => {
      // 最初のポイントは必ず追加
      if (prev.route.length === 0) {
        return {
          ...prev,
          route: [newPoint],
          distance: 0
        };
      }

      const lastPoint = prev.route[prev.route.length - 1];
      const segmentDistance = calculateDistance(
        lastPoint.lat,
        lastPoint.lng,
        newPoint.lat,
        newPoint.lng
      );

      // 最小距離閾値（メートル）- 精度に応じて調整
      const minDistanceThreshold = Math.max(5, position.accuracy * 0.5);
      
      // 一定距離進んだ場合のみポイントを追加
      if (segmentDistance >= minDistanceThreshold) {
        const newRoute = [...prev.route, newPoint];
        const newDistance = prev.distance + segmentDistance;

        return {
          ...prev,
          route: newRoute,
          distance: newDistance
        };
      }

      // 距離が足りない場合はポイントを追加せず、距離のみ更新
      // （内部的な累積距離として保持するため）
      return {
        ...prev,
        distance: prev.distance + segmentDistance
      };
    });
  };

  return {
    routeState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRoute,
    addPoint
  };
};