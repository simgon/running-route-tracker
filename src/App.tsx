import React, { useEffect, useState } from 'react';
import GoogleMap from './components/GoogleMap';
import SaveRouteModal from './components/SaveRouteModal';
import RouteList from './components/RouteList';
import { useGeolocation } from './hooks/useGeolocation';
import { useRunningRoute } from './hooks/useRunningRoute';
import { useRouteStorage } from './hooks/useRouteStorage';
import { RunningRoute } from './lib/supabase';
import { RoutePoint } from './hooks/useRunningRoute';
import './App.css';

function App() {
  const { position, error, loading, startTracking, stopTracking, isTracking } = useGeolocation();
  const { routeState, startRecording, stopRecording, pauseRecording, resumeRecording, clearRoute, addPoint } = useRunningRoute();
  const { saveRoute, isLoading: isSaving } = useRouteStorage();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loadedRoute, setLoadedRoute] = useState<RoutePoint[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableRoute, setEditableRoute] = useState<RoutePoint[]>([]);
  
  // デフォルトの位置（東京駅）
  const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503
  };

  // 現在位置があれば使用、なければデフォルト
  const mapCenter = position ? { lat: position.lat, lng: position.lng } : defaultCenter;
  const userPosition = position ? { lat: position.lat, lng: position.lng } : null;

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // GPS位置が更新されたらルートに追加（デモモードでない場合）
  useEffect(() => {
    if (position && routeState.isRecording && !isDemoMode) {
      addPoint(position);
    }
  }, [position, routeState.isRecording, addPoint, isDemoMode]);

  // 地図クリック処理：デモモードまたは編集モード
  const handleMapClick = (lat: number, lng: number) => {
    if (isDemoMode && routeState.isRecording) {
      // デモモード：録画中にクリックでポイント追加
      const demoPosition = {
        lat,
        lng,
        accuracy: 5, // 高精度設定
        timestamp: Date.now()
      };
      addPoint(demoPosition);
    } else if (isEditMode) {
      // 編集モード：クリックでピンを追加
      const newPoint: RoutePoint = {
        lat,
        lng,
        accuracy: 5,
        timestamp: Date.now()
      };
      setEditableRoute(prevRoute => [...prevRoute, newPoint]);
    }
  };

  // 距離をフォーマット
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  // 時間をフォーマット
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // ペースを計算（分/km）
  const calculatePace = () => {
    if (routeState.distance === 0 || routeState.duration === 0) return '--:--';
    const kmDistance = routeState.distance / 1000;
    const minutesDuration = routeState.duration / 60000;
    const pace = minutesDuration / kmDistance;
    const paceMinutes = Math.floor(pace);
    const paceSeconds = Math.floor((pace - paceMinutes) * 60);
    return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
  };

  // ルート保存処理
  const handleSaveRoute = async (name: string, description?: string) => {
    try {
      await saveRoute(
        name,
        description,
        routeState.route,
        routeState.distance,
        routeState.duration
      );
      // 保存成功後はルートをクリア
      clearRoute();
      setLoadedRoute([]);
    } catch (error) {
      // エラーはSaveRouteModalで表示される
      throw error;
    }
  };

  // 保存済みルートを読み込み
  const handleLoadRoute = (route: RunningRoute) => {
    // GeoJSON LineStringをRoutePointに変換
    const routePoints: RoutePoint[] = route.route_data.coordinates.map((coord, index) => ({
      lat: coord[1],
      lng: coord[0],
      timestamp: Date.now() + index * 1000, // 仮のタイムスタンプ
      accuracy: route.elevation_data?.[index] || 5
    }));

    setLoadedRoute(routePoints);
    setEditableRoute([...routePoints]); // 編集用にコピー
    clearRoute(); // 現在の記録をクリア
    setIsEditMode(false); // 編集モード無効
  };

  // 編集モード開始
  const startEditMode = () => {
    if (loadedRoute.length > 0) {
      setEditableRoute([...loadedRoute]);
      setIsEditMode(true);
    }
  };

  // 編集モード終了
  const stopEditMode = () => {
    setIsEditMode(false);
    setEditableRoute([]);
  };

  // 編集モードで適用
  const applyEdit = () => {
    setLoadedRoute([...editableRoute]);
    setIsEditMode(false);
    setEditableRoute([]);
  };

  // ポイントドラッグ処理（ちらつき防止のため参照を保持）
  const handlePointDrag = React.useCallback((index: number, lat: number, lng: number) => {
    setEditableRoute(prevRoute => {
      const newRoute = [...prevRoute];
      newRoute[index] = {
        ...newRoute[index],
        lat,
        lng
      };
      return newRoute;
    });
  }, []);

  // ポイント削除処理
  const handlePointDelete = React.useCallback((index: number) => {
    setEditableRoute(prevRoute => prevRoute.filter((_, i) => i !== index));
  }, []);

  // ルート線クリック時にピンを挿入
  const handleRouteLineClick = React.useCallback((lat: number, lng: number) => {
    if (!isEditMode) return;

    // 最も近いセグメントを見つけて、そこにピンを挿入
    const newPoint: RoutePoint = {
      lat,
      lng,
      accuracy: 5,
      timestamp: Date.now()
    };

    // クリックした位置に最も近いセグメントのインデックスを計算
    let minDistance = Infinity;
    let insertIndex = editableRoute.length;

    for (let i = 0; i < editableRoute.length - 1; i++) {
      const segmentDistance = getDistanceToSegment(
        lat, lng,
        editableRoute[i].lat, editableRoute[i].lng,
        editableRoute[i + 1].lat, editableRoute[i + 1].lng
      );
      
      if (segmentDistance < minDistance) {
        minDistance = segmentDistance;
        insertIndex = i + 1;
      }
    }

    setEditableRoute(prevRoute => {
      const newRoute = [...prevRoute];
      newRoute.splice(insertIndex, 0, newPoint);
      return newRoute;
    });
  }, [isEditMode, editableRoute]);

  // 点と線分の距離を計算
  const getDistanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const A = px - ax;
    const B = py - ay;
    const C = bx - ax;
    const D = by - ay;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = ax;
      yy = ay;
    } else if (param > 1) {
      xx = bx;
      yy = by;
    } else {
      xx = ax + param * C;
      yy = ay + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ margin: '5px 0', fontSize: '1.5em' }}>Running Route Tracker</h1>
        <p style={{ margin: '5px 0', fontSize: '0.9em' }}>ランニングルートを記録・共有しよう</p>
      </header>

      {/* 制御パネル */}
      <div style={{ 
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef'
      }}>
        {/* モード切替とGPS制御 */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '15px'
        }}>
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            style={{
              padding: '10px 20px',
              backgroundColor: isDemoMode ? '#17a2b8' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isDemoMode ? '🖱️ デモモード' : '📱 実機モード'}
          </button>

          <RouteList onLoadRoute={handleLoadRoute} />

          {loadedRoute.length > 0 && !isEditMode && (
            <button
              onClick={startEditMode}
              style={{
                padding: '10px 20px',
                backgroundColor: '#fd7e14',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✏️ 編集
            </button>
          )}

          {isEditMode && (
            <>
              <button
                onClick={applyEdit}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✅ 適用
              </button>
              <button
                onClick={stopEditMode}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ キャンセル
              </button>
            </>
          )}

          {!isDemoMode && (
            <button
              onClick={isTracking ? stopTracking : startTracking}
              style={{
                padding: '10px 20px',
                backgroundColor: isTracking ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isTracking ? '📍 GPS停止' : '🎯 GPS開始'}
            </button>
          )}
          
          {loading && <span>📡 位置情報取得中...</span>}
          {error && <span style={{ color: '#dc3545' }}>❌ {error.message}</span>}
          {position && (
            <span style={{ fontSize: '0.9em', color: '#6c757d' }}>
              📍 緯度: {position.lat.toFixed(6)}, 経度: {position.lng.toFixed(6)} 
              (精度: {position.accuracy.toFixed(0)}m)
            </span>
          )}
        </div>

        {/* ランニング制御 */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '15px'
        }}>
          {!routeState.isRecording && routeState.route.length === 0 && (
            <button
              onClick={startRecording}
              disabled={!isDemoMode && !position}
              style={{
                padding: '10px 20px',
                backgroundColor: (isDemoMode || position) ? '#007bff' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (isDemoMode || position) ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              🏃‍♂️ 記録開始
            </button>
          )}
          
          {routeState.isRecording && (
            <button
              onClick={pauseRecording}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ⏸️ 一時停止
            </button>
          )}
          
          {!routeState.isRecording && routeState.route.length > 0 && (
            <>
              <button
                onClick={resumeRecording}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ▶️ 再開
              </button>
              <button
                onClick={stopRecording}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ⏹️ 停止
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                💾 保存
              </button>
            </>
          )}
          
          {routeState.route.length > 0 && (
            <button
              onClick={clearRoute}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🗑️ クリア
            </button>
          )}
        </div>

        {/* モード説明 */}
        {isDemoMode && (
          <div style={{
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '5px',
            padding: '10px',
            marginBottom: '15px',
            fontSize: '0.9em'
          }}>
            🖱️ <strong>デモモード:</strong> 地図をクリックしてルートを作成できます。「記録開始」後に地図上をクリックしてください。
          </div>
        )}

        {isEditMode && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px',
            padding: '10px',
            marginBottom: '15px',
            fontSize: '0.9em'
          }}>
            ✏️ <strong>編集モード:</strong> 地図クリックでピン追加、ルート線クリックで間にピン挿入、ピンを左クリック&ドラッグで移動、右クリックで削除できます。
            <br />
            🟢 スタート / 🟠 中間ポイント / 🔴 ゴール / 🩷 ドラッグ中
          </div>
        )}

        {/* 統計情報 */}
        {routeState.route.length > 0 && (
          <div style={{ 
            display: 'flex',
            gap: '20px',
            fontSize: '1.1em',
            fontWeight: 'bold'
          }}>
            <span>📏 距離: {formatDistance(routeState.distance)}</span>
            <span>⏱️ 時間: {formatDuration(routeState.duration)}</span>
            <span>🏃‍♂️ ペース: {calculatePace()}/km</span>
            <span>📍 ポイント数: {routeState.route.length}</span>
          </div>
        )}
      </div>

      <main style={{ flex: 1, margin: '10px', minHeight: 0 }}>
        {apiKey ? (
          <GoogleMap
            apiKey={apiKey}
            center={mapCenter}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            userPosition={userPosition}
            routePoints={
              isEditMode ? editableRoute : 
              routeState.route.length > 0 ? routeState.route : loadedRoute
            }
            isRecording={routeState.isRecording}
            onMapClick={handleMapClick}
            isDemoMode={isDemoMode}
            isEditMode={isEditMode}
            onPointDrag={handlePointDrag}
            onPointDelete={handlePointDelete}
            onRouteLineClick={handleRouteLineClick}
          />
        ) : (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            color: '#666'
          }}>
            Google Maps API キーを設定してください
          </div>
        )}
      </main>

      {/* ルート保存モーダル */}
      <SaveRouteModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveRoute}
        distance={routeState.distance}
        duration={routeState.duration}
        isLoading={isSaving}
      />
    </div>
  );
}

export default App;
