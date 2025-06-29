import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { RunningRoute } from '../lib/supabase';
import { useRouteStorage } from '../hooks/useRouteStorage';

interface RouteListSidebarProps {
  onLoadRoute: (route: RunningRoute) => void;
  onDeleteRoute: (routeId: string, routeName: string) => void;
  onToggleAllRoutes?: (routes: RunningRoute[]) => void;
  onStartManualCreation?: () => void;
  onEditRoute?: () => void;
  selectedRouteId?: string;
  showAllRoutes?: boolean;
  isRecording?: boolean;
}

export interface RouteListSidebarRef {
  refreshRoutes: () => Promise<void>;
}

const RouteListSidebar = forwardRef<RouteListSidebarRef, RouteListSidebarProps>(({ onLoadRoute, onDeleteRoute, onToggleAllRoutes, onStartManualCreation, onEditRoute, selectedRouteId, showAllRoutes = false, isRecording = false }, ref) => {
  const { loadUserRoutes, isLoading } = useRouteStorage();
  const [routes, setRoutes] = useState<RunningRoute[]>([]);
  const [error, setError] = useState<string | null>(null);

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadRoutes = async () => {
    try {
      setError(null);
      const userRoutes = await loadUserRoutes();
      setRoutes(userRoutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ルートの読み込みに失敗しました');
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  // 削除処理をラップして、削除後に一覧を更新
  const handleDeleteWithRefresh = async (routeId: string, routeName: string) => {
    try {
      await onDeleteRoute(routeId, routeName);
      // 削除後にルート一覧を再読み込み
      await loadRoutes();
    } catch (error) {
      // エラーは親コンポーネントで処理されるため、ここでは再読み込みのみ実行
      await loadRoutes();
    }
  };

  // refから呼び出せるメソッドを公開
  useImperativeHandle(ref, () => ({
    refreshRoutes: loadRoutes
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 手動作成ボタン */}
      <div style={{ 
        marginBottom: '15px',
        textAlign: 'left'
      }}>
        {onStartManualCreation && (
          <button
            onClick={onStartManualCreation}
            disabled={isRecording}
            style={{
              width: '100%',
              padding: '10px 15px',
              backgroundColor: isRecording ? '#28a745' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecording ? 'default' : 'pointer',
              fontSize: '1em',
              fontWeight: 'bold',
              opacity: isRecording ? 0.8 : 1
            }}
          >
            {isRecording ? '✏️ 手動作成中' : '✏️ 新規ルート作成'}
          </button>
        )}
      </div>

      <div style={{ 
        marginBottom: '20px',
        textAlign: 'left'
      }}>
        <h3 style={{ 
          margin: '0 0 10px 0',
          fontSize: '1.2em',
          color: '#333'
        }}>
          📂 保存済みルート
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadRoutes}
            style={{
              padding: '5px 10px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
          >
            🔄 更新
          </button>
          {routes.length > 1 && onToggleAllRoutes && (
            <button
              onClick={() => onToggleAllRoutes(routes)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
            >
              🗺️ 全て表示
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            📡 読み込み中...
          </div>
        )}

        {error && (
          <div style={{
            color: '#dc3545',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px',
            padding: '10px',
            marginBottom: '15px',
            fontSize: '0.9em'
          }}>
            {error}
          </div>
        )}

        {!isLoading && !error && routes.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#6c757d',
            fontSize: '0.9em'
          }}>
            まだ保存されたルートがありません
          </div>
        )}

        {routes.map((route) => {
          const isSelected = selectedRouteId === route.id;
          const isInactive = showAllRoutes && !isSelected;
          
          return (
          <div
            key={route.id}
            style={{
              border: isSelected ? '2px solid #007bff' : '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '10px',
              transition: 'all 0.2s',
              backgroundColor: isSelected ? '#f0f8ff' : '#ffffff',
              fontSize: '0.9em',
              position: 'relative',
              opacity: isInactive ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
          >
            {/* 編集ボタン */}
            {isSelected && onEditRoute && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRoute();
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '36px',
                  background: '#fd7e14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e96600';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fd7e14';
                }}
                title={`${route.name}を編集`}
              >
                ✏️
              </button>
            )}

            {/* 削除ボタン */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteWithRefresh(route.id, route.name);
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#c82333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
              }}
              title={`${route.name}を削除`}
            >
              ×
            </button>

            {/* ルート情報（クリック可能エリア） */}
            <div
              onClick={() => onLoadRoute(route)}
              style={{ cursor: 'pointer', paddingRight: isSelected ? '64px' : '30px' }}
            >
            <div style={{ 
              marginBottom: '8px'
            }}>
              <h4 style={{ 
                margin: '0 0 5px 0', 
                color: '#007bff',
                fontSize: '1em',
                fontWeight: 'bold'
              }}>
                {route.name}
              </h4>
              <span style={{ 
                fontSize: '0.8em', 
                color: '#6c757d'
              }}>
                {formatDate(route.created_at)}
              </span>
            </div>
            
            {route.description && (
              <p style={{ 
                margin: '0 0 8px 0', 
                color: '#6c757d',
                fontSize: '0.8em',
                lineHeight: 1.3
              }}>
                {route.description}
              </p>
            )}
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '3px',
              fontSize: '0.8em',
              color: '#495057'
            }}>
              <div>📏 {formatDistance(route.distance)}</div>
              <div>⏱️ {formatDuration(route.duration || 0)}</div>
              <div>📍 {route.route_data.coordinates?.length || 0}ポイント</div>
            </div>
            </div>
          </div>
          );
        })}
      </div>

      {routes.length > 0 && (
        <div style={{ 
          marginTop: '15px',
          textAlign: 'center',
          fontSize: '0.8em',
          color: '#6c757d',
          paddingTop: '15px',
          borderTop: '1px solid #e9ecef'
        }}>
          ルートをクリックして地図に表示
        </div>
      )}
    </div>
  );
});

export default RouteListSidebar;