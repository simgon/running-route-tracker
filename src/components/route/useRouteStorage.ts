import { useState } from "react";
import {
  saveRunningRoute,
  getUserRunningRoutes,
  updateRunningRoute,
  deleteRunningRoute,
  RunningRoute,
} from "../../lib/supabase";
import { RoutePoint } from "../../types/route";
import { LineString } from "geojson";

export interface UseRouteStorageReturn {
  saveRoute: (
    name: string,
    description: string | undefined,
    routePoints: RoutePoint[],
    distance: number,
    duration: number
  ) => Promise<RunningRoute>;
  updateRoute: (
    routeId: string,
    routePoints: RoutePoint[],
    distance: number,
    duration?: number
  ) => Promise<RunningRoute>;
  deleteRoute: (routeId: string) => Promise<void>;
  updateRouteName: (routeId: string, name: string) => Promise<RunningRoute>;
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
      const coordinates: [number, number][] = routePoints.map((point) => [point.lng, point.lat]);

      const routeData: LineString = {
        type: "LineString",
        coordinates,
      };

      // 標高データ（今回は精度情報で代用）
      const elevationData = routePoints.map((point) => point.accuracy);

      const routeToSave = {
        user_id: "", // generateAnonymousUserIdで自動設定される
        name,
        description,
        distance,
        duration: duration, // 既に秒単位で渡される
        route_data: routeData,
        elevation_data: elevationData,
      };

      const savedRoute = await saveRunningRoute(routeToSave);
      return savedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ルートの保存に失敗しました";
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
      // 認証済みユーザーの場合は認証情報を使用、匿名ユーザーの場合はlocalStorageから取得
      const anonymousId = localStorage.getItem("anonymous_user_id");
      const routes = await getUserRunningRoutes(anonymousId || undefined);
      return routes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ルートの読み込みに失敗しました";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoute = async (
    routeId: string,
    routePoints: RoutePoint[],
    distance: number,
    duration?: number
  ): Promise<RunningRoute> => {
    setIsLoading(true);
    setError(null);

    try {
      // RoutePointをGeoJSON LineString形式に変換
      const coordinates: [number, number][] = routePoints.map((point) => [point.lng, point.lat]);

      const routeData: LineString = {
        type: "LineString",
        coordinates,
      };

      // 標高データ（今回は精度情報で代用）
      const elevationData = routePoints.map((point) => point.accuracy);

      const updateData: any = {
        distance,
        route_data: routeData,
        elevation_data: elevationData,
        ...(duration !== undefined && { duration }),
      };

      const updatedRoute = await updateRunningRoute(routeId, updateData);

      return updatedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ルートの更新に失敗しました";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (routeId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await deleteRunningRoute(routeId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ルートの削除に失敗しました";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRouteName = async (routeId: string, name: string): Promise<RunningRoute> => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedRoute = await updateRunningRoute(routeId, { name });
      return updatedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ルート名の更新に失敗しました";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saveRoute,
    updateRoute,
    deleteRoute,
    updateRouteName,
    loadUserRoutes,
    isLoading,
    error,
  };
};
