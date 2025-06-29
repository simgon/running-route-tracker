import React, { useState, useEffect } from 'react';
import { RunningRoute } from '../lib/supabase';
import { useRouteStorage } from '../hooks/useRouteStorage';

interface RouteListProps {
  onLoadRoute: (route: RunningRoute) => void;
}

const RouteList: React.FC<RouteListProps> = ({ onLoadRoute }) => {
  const { loadUserRoutes, isLoading } = useRouteStorage();
  const [routes, setRoutes] = useState<RunningRoute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
      year: 'numeric',
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
    if (isOpen) {
      loadRoutes();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '10px 20px',
          backgroundColor: '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        📂 保存済みルート
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0 }}>保存済みルート</h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '5px 10px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
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
              marginBottom: '15px'
            }}>
              {error}
            </div>
          )}

          {!isLoading && !error && routes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              まだ保存されたルートがありません
            </div>
          )}

          {routes.map((route) => (
            <div
              key={route.id}
              style={{
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                backgroundColor: '#ffffff'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
              onClick={() => {
                onLoadRoute(route);
                setIsOpen(false);
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '10px'
              }}>
                <h3 style={{ margin: 0, color: '#007bff' }}>{route.name}</h3>
                <span style={{ fontSize: '0.9em', color: '#6c757d' }}>
                  {formatDate(route.created_at)}
                </span>
              </div>
              
              {route.description && (
                <p style={{ 
                  margin: '0 0 10px 0', 
                  color: '#6c757d',
                  fontSize: '0.9em'
                }}>
                  {route.description}
                </p>
              )}
              
              <div style={{ 
                display: 'flex', 
                gap: '20px',
                fontSize: '0.9em',
                color: '#495057'
              }}>
                <span>📏 {formatDistance(route.distance)}</span>
                <span>⏱️ {formatDuration(route.duration || 0)}</span>
                <span>📍 {route.route_data.coordinates?.length || 0}ポイント</span>
              </div>
            </div>
          ))}
        </div>

        {routes.length > 0 && (
          <div style={{ 
            marginTop: '15px',
            textAlign: 'center',
            fontSize: '0.9em',
            color: '#6c757d'
          }}>
            ルートをクリックして地図に表示
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteList;