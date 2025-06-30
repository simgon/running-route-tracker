import React, { useState } from "react";

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
  distance: number;
  duration: number;
  isLoading?: boolean;
}

const SaveRouteModal: React.FC<SaveRouteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  distance,
  duration,
  isLoading = false,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60)
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("ルート名を入力してください");
      return;
    }

    try {
      setError("");
      await onSave(name.trim(), description.trim() || undefined);
      // 成功時はリセット
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setError("");
    onClose();
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
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "10px",
          width: "90%",
          maxWidth: "500px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>ランニングルートを保存</h2>

        {/* ルート情報 */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "15px",
            borderRadius: "5px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", gap: "20px", fontSize: "1.1em" }}>
            <span>📏 距離: {formatDistance(distance)}</span>
            <span>⏱️ 時間: {formatDuration(duration)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              ルート名 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 朝の公園ランニング"
              style={{
                width: "95%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
                fontSize: "16px",
              }}
              disabled={isLoading}
              maxLength={255}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              説明 (任意)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ルートの特徴や感想を記録..."
              style={{
                width: "95%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "5px",
                fontSize: "16px",
                minHeight: "80px",
                resize: "vertical",
              }}
              disabled={isLoading}
              maxLength={1000}
            />
          </div>

          {error && (
            <div
              style={{
                color: "#dc3545",
                backgroundColor: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: "5px",
                padding: "10px",
                marginBottom: "15px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              style={{
                padding: "10px 20px",
                backgroundColor: isLoading || !name.trim() ? "#6c757d" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isLoading || !name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "保存中..." : "💾 保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveRouteModal;
