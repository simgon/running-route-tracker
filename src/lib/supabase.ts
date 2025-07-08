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
  order_index?: number; // 並び替え順序
  is_visible?: boolean; // ルート表示有無
  created_at: string;
  updated_at: string;
}

// ランニングルートを保存する関数
export const saveRunningRoute = async (route: Omit<RunningRoute, 'id' | 'created_at' | 'updated_at'>) => {
  // 認証済みユーザーか匿名ユーザーかを判定
  const { data: { user } } = await supabase.auth.getUser();
  
  let routeData;
  if (user) {
    // 認証済みユーザー
    routeData = {
      ...route,
      user_id: user.id,
      anonymous_user_id: null,
      is_visible: route.is_visible ?? true  // デフォルトは表示
    };
  } else {
    // 匿名ユーザー（既存の仕組み）
    const anonymousId = generateAnonymousUserId();
    routeData = {
      ...route,
      user_id: null,
      anonymous_user_id: anonymousId,
      is_visible: route.is_visible ?? true  // デフォルトは表示
    };
  }

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
export const getUserRunningRoutes = async (anonymousUserId?: string) => {
  // 認証済みユーザーか匿名ユーザーかを判定
  const { data: { user } } = await supabase.auth.getUser();
  
  let query = supabase
    .from('running_routes')
    .select('*');
  
  if (user) {
    // 認証済みユーザーのルートを取得
    query = query.eq('user_id', user.id);
  } else if (anonymousUserId) {
    // 匿名ユーザーのルートを取得
    query = query.eq('anonymous_user_id', anonymousUserId);
  } else {
    // 匿名ユーザーでIDがない場合は空配列を返す
    return [];
  }
  
  const { data, error } = await query
    .order('order_index', { ascending: true, nullsFirst: false })
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

// ルートの並び替え順序を更新する関数
export const updateRoutesOrder = async (routeIds: string[]) => {
  // 各ルートのorder_indexを個別に更新
  for (let i = 0; i < routeIds.length; i++) {
    const { error } = await supabase
      .from('running_routes')
      .update({ order_index: i })
      .eq('id', routeIds[i]);

    if (error) {
      throw new Error(`Failed to update route order for ${routeIds[i]}: ${error.message}`);
    }
  }
};

// ルートの表示状態を更新する関数
export const updateRouteVisibility = async (routeId: string, isVisible: boolean) => {
  const { data, error } = await supabase
    .from('running_routes')
    .update({
      is_visible: isVisible,
      updated_at: new Date().toISOString()
    })
    .eq('id', routeId)
    .select();

  if (error) {
    throw new Error(`Failed to update route visibility: ${error.message}`);
  }

  return data[0];
};

// 匿名ユーザーのルートを認証済みユーザーに移行する関数
export const migrateAnonymousRoutesToUser = async (userId: string, anonymousUserId: string) => {
  try {
    // 匿名ユーザーのルートを取得
    const { data: anonymousRoutes, error: fetchError } = await supabase
      .from('running_routes')
      .select('*')
      .eq('anonymous_user_id', anonymousUserId);

    if (fetchError) {
      throw new Error(`Failed to fetch anonymous routes: ${fetchError.message}`);
    }

    if (!anonymousRoutes || anonymousRoutes.length === 0) {
      return { migratedCount: 0 };
    }

    // 各ルートのuser_idを更新し、anonymous_user_idをnullに設定
    const { data: updatedRoutes, error: updateError } = await supabase
      .from('running_routes')
      .update({
        user_id: userId,
        anonymous_user_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('anonymous_user_id', anonymousUserId)
      .select();

    if (updateError) {
      throw new Error(`Failed to migrate routes: ${updateError.message}`);
    }

    return { 
      migratedCount: updatedRoutes.length,
      migratedRoutes: updatedRoutes
    };
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};