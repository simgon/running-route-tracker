import { createClient } from '@supabase/supabase-js';
import { LineString } from 'geojson';

// 環境変数から Supabase の設定を取得
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

// Supabase クライアントを作成
export const supabase = createClient(supabaseUrl, supabaseKey);

// ランニングルートの型定義
export interface RunningRoute {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  distance: number; // メートル単位
  duration?: number; // 秒単位
  route_data: LineString;
  elevation_data?: number[];
  created_at: string;
  updated_at: string;
}

// ランニングルートを保存する関数
export const saveRunningRoute = async (route: Omit<RunningRoute, 'id' | 'created_at' | 'updated_at'>) => {
  // 匿名ユーザーIDを生成
  const anonymousId = generateAnonymousUserId();
  
  const routeData = {
    ...route,
    user_id: null, // 匿名ユーザーはnull
    anonymous_user_id: anonymousId
  };

  const { data, error } = await supabase
    .from('running_routes')
    .insert([routeData])
    .select();

  if (error) {
    throw new Error(`Failed to save route: ${error.message}`);
  }

  return data[0];
};

// 匿名ユーザーIDを生成する関数（UUID形式）
const generateAnonymousUserId = (): string => {
  // ローカルストレージから既存のIDを取得、なければ生成
  let anonymousId = localStorage.getItem('anonymous_user_id');
  
  if (!anonymousId) {
    // UUID v4形式で生成
    anonymousId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem('anonymous_user_id', anonymousId);
  }
  
  return anonymousId;
};

// ユーザーのランニングルートを取得する関数
export const getUserRunningRoutes = async (anonymousUserId: string) => {
  const { data, error } = await supabase
    .from('running_routes')
    .select('*')
    .eq('anonymous_user_id', anonymousUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch routes: ${error.message}`);
  }

  return data;
};

// ランニングルートを更新する関数
export const updateRunningRoute = async (
  routeId: string, 
  updates: Partial<Omit<RunningRoute, 'id' | 'created_at' | 'updated_at'>>
) => {
  const { data, error } = await supabase
    .from('running_routes')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', routeId)
    .select();

  if (error) {
    throw new Error(`Failed to update route: ${error.message}`);
  }

  return data[0];
};

// ランニングルートを削除する関数
export const deleteRunningRoute = async (routeId: string) => {
  const { error } = await supabase
    .from('running_routes')
    .delete()
    .eq('id', routeId);

  if (error) {
    throw new Error(`Failed to delete route: ${error.message}`);
  }
};