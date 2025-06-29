import { useState } from 'react';
import { saveRunningRoute, getUserRunningRoutes, RunningRoute } from '../lib/supabase';
import { RoutePoint } from './useRunningRoute';
import { LineString } from 'geojson';

export interface UseRouteStorageReturn {
  saveRoute: (name: string, description: string | undefined, routePoints: RoutePoint[], distance: number, duration: number) => Promise<RunningRoute>;
  loadUserRoutes: () => Promise<RunningRoute[]>;
  isLoading: boolean;
  error: string | null;
}

export const useRouteStorage = (): UseRouteStorageReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveRoute = async (
    name: string,
    description: string | undefined,
    routePoints: RoutePoint[],
    distance: number,
    duration: number
  ): Promise<RunningRoute> => {
    setIsLoading(true);
    setError(null);

    try {
      // RoutePointをGeoJSON LineString形式に変換
      const coordinates: [number, number][] = routePoints.map(point => [point.lng, point.lat]);
      
      const routeData: LineString = {
        type: 'LineString',
        coordinates
      };

      // 標高データ（今回は精度情報で代用）
      const elevationData = routePoints.map(point => point.accuracy);

      const routeToSave = {
        user_id: '', // generateAnonymousUserIdで自動設定される
        name,
        description,
        distance,
        duration: Math.floor(duration / 1000), // ミリ秒を秒に変換
        route_data: routeData,
        elevation_data: elevationData
      };

      const savedRoute = await saveRunningRoute(routeToSave);
      return savedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ルートの保存に失敗しました';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRoutes = async (): Promise<RunningRoute[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // ローカルストレージから匿名ユーザーIDを取得
      const anonymousId = localStorage.getItem('anonymous_user_id');
      if (!anonymousId) {
        return []; // まだルートを保存したことがない
      }

      const routes = await getUserRunningRoutes(anonymousId);
      return routes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ルートの読み込みに失敗しました';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saveRoute,
    loadUserRoutes,
    isLoading,
    error
  };
};