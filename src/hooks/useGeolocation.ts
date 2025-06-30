import { useState, useEffect } from 'react';

export interface CustomGeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface UseGeolocationReturn {
  position: CustomGeolocationPosition | null;
  error: GeolocationError | null;
  loading: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  isTracking: boolean;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [position, setPosition] = useState<CustomGeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const handleSuccess = (pos: GeolocationPosition) => {
    const newPosition: CustomGeolocationPosition = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp
    };
    setPosition(newPosition);
    setError(null);
    setLoading(false);
  };

  const handleError = (err: GeolocationPositionError) => {
    let message = err.message;
    
    // より分かりやすいエラーメッセージに変換
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = "位置情報の使用が拒否されました。ブラウザの設定で位置情報を許可してください。";
        break;
      case err.POSITION_UNAVAILABLE:
        message = "位置情報が取得できません。GPS信号が受信できない可能性があります。";
        break;
      case err.TIMEOUT:
        message = "位置情報の取得がタイムアウトしました。";
        break;
    }
    
    const newError: GeolocationError = {
      code: err.code,
      message: message
    };
    setError(newError);
    setLoading(false);
    
    // Position unavailableエラーの場合、トラッキングを停止
    if (err.code === err.POSITION_UNAVAILABLE) {
      setIsTracking(false);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by this browser.'
      });
      return;
    }

    setLoading(true);
    setIsTracking(true);
    setError(null);

    // 高精度GPS設定（ランニング用）
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // タイムアウトを延長
      maximumAge: 5000 // キャッシュ期間を延長
    };

    // リアルタイム位置追跡を開始
    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    setWatchId(id);
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
    setLoading(false);
  };

  // 初回マウント時に現在位置を取得
  useEffect(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: false, // 初回は低精度で高速取得
          timeout: 8000,
          maximumAge: 300000 // 5分間キャッシュ
        }
      );
    }
  }, []);

  // コンポーネントアンマウント時にトラッキング停止
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    position,
    error,
    loading,
    startTracking,
    stopTracking,
    isTracking
  };
};