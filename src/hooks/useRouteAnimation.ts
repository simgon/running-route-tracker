import { useState, useCallback, useRef } from 'react';
import { RoutePoint } from './useRunningRoute';

export type AnimationType = 'draw' | 'pulse' | 'flash' | 'none';

export interface RouteAnimationConfig {
  type: AnimationType;
  speed: number; // milliseconds per point for 'draw', interval for others
  color: string;
  lineWidth: number;
  autoStart: boolean;
}

export interface UseRouteAnimationReturn {
  isAnimating: boolean;
  animationType: AnimationType;
  config: RouteAnimationConfig;
  startAnimation: (routePoints: RoutePoint[], type?: AnimationType) => void;
  stopAnimation: () => void;
  updateConfig: (newConfig: Partial<RouteAnimationConfig>) => void;
  setAnimationType: (type: AnimationType) => void;
}

const defaultConfig: RouteAnimationConfig = {
  type: 'draw',
  speed: 100,
  color: '#FF4444',
  lineWidth: 4,
  autoStart: false,
};

export const useRouteAnimation = (
  initialConfig: Partial<RouteAnimationConfig> = {}
): UseRouteAnimationReturn => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<AnimationType>('draw');
  const [config, setConfig] = useState<RouteAnimationConfig>({
    ...defaultConfig,
    ...initialConfig,
  });

  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = useCallback((routePoints: RoutePoint[], type?: AnimationType) => {
    if (routePoints.length === 0) return;

    // 既存のアニメーションを停止
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    const selectedType = type || config.type;
    setAnimationType(selectedType);
    setIsAnimating(true);

    // アニメーション完了後の自動停止
    const duration = calculateAnimationDuration(routePoints.length, selectedType, config.speed);
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, duration);
  }, [config]);

  const stopAnimation = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<RouteAnimationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const setAnimationTypeCallback = useCallback((type: AnimationType) => {
    setAnimationType(type);
    updateConfig({ type });
  }, [updateConfig]);

  return {
    isAnimating,
    animationType,
    config,
    startAnimation,
    stopAnimation,
    updateConfig,
    setAnimationType: setAnimationTypeCallback,
  };
};

// アニメーション時間を計算
const calculateAnimationDuration = (
  pointCount: number, 
  type: AnimationType, 
  speed: number
): number => {
  switch (type) {
    case 'draw':
      return pointCount * speed + 1000; // 描画時間 + バッファ
    case 'pulse':
      return 3 * 600 + 500; // 3回パルス + バッファ
    case 'flash':
      return 5 * 200 + 500; // 5回フラッシュ + バッファ
    default:
      return 1000;
  }
};

export default useRouteAnimation;