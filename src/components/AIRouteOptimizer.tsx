import React, { useState } from "react";
import { RoutePoint } from "../hooks/useRunningRoute";
import { AIRouteGenerator, RoutePreferences } from "../utils/aiRouteGenerator";

interface AIRouteOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateRoute: (route: RoutePoint[]) => void;
  currentPosition?: google.maps.LatLngLiteral | null;
}


const AIRouteOptimizer: React.FC<AIRouteOptimizerProps> = ({
  isOpen,
  onClose,
  onGenerateRoute,
  currentPosition,
}) => {
  const [preferences, setPreferences] = useState<RoutePreferences>({
    distance: 5,
    difficulty: "moderate",
    terrain: "mixed",
    scenery: "mixed",
    avoidTraffic: true,
    preferParks: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRoutes, setGeneratedRoutes] = useState<RoutePoint[][]>([]);

  // AIルート生成（実際のAI実装）
  const generateOptimizedRoute = async () => {
    if (!currentPosition) {
      alert("現在位置が取得できません。位置情報を有効にしてください。");
      return;
    }

    setIsGenerating(true);
    
    try {
      const aiGenerator = AIRouteGenerator.getInstance();
      const routes = await aiGenerator.generateOptimizedRoutes(currentPosition, preferences);
      setGeneratedRoutes(routes);
      
    } catch (error) {
      console.error("AI route generation failed:", error);
      alert("ルート生成に失敗しました。もう一度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };


  const selectRoute = (routeIndex: number) => {
    if (generatedRoutes[routeIndex]) {
      onGenerateRoute(generatedRoutes[routeIndex]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, color: "#333", fontSize: "1.5em" }}>
            🤖 AIルート最適化
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        {generatedRoutes.length === 0 ? (
          <div>
            {/* 設定セクション */}
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ color: "#333", marginBottom: "15px" }}>ルート設定</h3>
              
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                  距離: {preferences.distance} km
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={preferences.distance}
                  onChange={(e) => setPreferences({...preferences, distance: parseFloat(e.target.value)})}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                  難易度
                </label>
                <select
                  value={preferences.difficulty}
                  onChange={(e) => setPreferences({...preferences, difficulty: e.target.value as any})}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                >
                  <option value="easy">初心者向け（平坦、安全重視）</option>
                  <option value="moderate">中級者向け（適度な起伏）</option>
                  <option value="hard">上級者向け（起伏あり、チャレンジング）</option>
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                  地形
                </label>
                <select
                  value={preferences.terrain}
                  onChange={(e) => setPreferences({...preferences, terrain: e.target.value as any})}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                >
                  <option value="flat">平坦（高低差少なめ）</option>
                  <option value="hills">起伏重視（トレーニング向け）</option>
                  <option value="mixed">バランス（適度な変化）</option>
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                  景観
                </label>
                <select
                  value={preferences.scenery}
                  onChange={(e) => setPreferences({...preferences, scenery: e.target.value as any})}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                >
                  <option value="urban">都市部（利便性重視）</option>
                  <option value="nature">自然（公園・河川沿い）</option>
                  <option value="mixed">バランス（都市と自然）</option>
                </select>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={preferences.avoidTraffic}
                    onChange={(e) => setPreferences({...preferences, avoidTraffic: e.target.checked})}
                  />
                  交通量の多い道路を避ける
                </label>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={preferences.preferParks}
                    onChange={(e) => setPreferences({...preferences, preferParks: e.target.checked})}
                  />
                  公園や緑地を優先する
                </label>
              </div>
            </div>

            <button
              onClick={generateOptimizedRoute}
              disabled={isGenerating || !currentPosition}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: isGenerating ? "#6c757d" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: isGenerating ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {isGenerating ? "🤖 AI分析中..." : "🚀 最適ルートを生成"}
            </button>
          </div>
        ) : (
          <div>
            {/* 生成されたルート選択 */}
            <h3 style={{ color: "#333", marginBottom: "15px" }}>
              AI推奨ルート ({preferences.distance}km)
            </h3>
            
            {generatedRoutes.map((route, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "15px",
                  marginBottom: "10px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: "#f8f9fa",
                }}
                onClick={() => selectRoute(index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e9ecef";
                  e.currentTarget.style.borderColor = "#007bff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                  e.currentTarget.style.borderColor = "#ddd";
                }}
              >
                <h4 style={{ margin: "0 0 8px 0", color: "#007bff" }}>
                  パターン {index + 1}
                  {index === 0 && " 🏆 最推奨"}
                  {index === 1 && " 🌿 景観重視"}
                  {index === 2 && " 💪 トレーニング"}
                </h4>
                <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
                  ポイント数: {route.length} | 
                  {index === 0 && " 安全性と走りやすさのバランスが最適"}
                  {index === 1 && " 美しい景観を楽しめるルート"}
                  {index === 2 && " 適度な起伏でトレーニング効果あり"}
                </p>
              </div>
            ))}
            
            <button
              onClick={() => setGeneratedRoutes([])}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                marginTop: "10px",
                cursor: "pointer",
              }}
            >
              ← 設定に戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIRouteOptimizer;