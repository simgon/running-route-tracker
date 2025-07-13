import React, { useState } from "react";
import { IconButton, styled } from "@mui/material";
import { MyLocation, LocationOff } from "@mui/icons-material";

interface CurrentLocationButtonProps {
  onLocationToggle: (enable: boolean) => void;
  disabled?: boolean;
  isTracking?: boolean;
}

const LocationButton = styled(IconButton)<{ $isActive?: boolean }>(({ theme, $isActive }) => ({
  position: "absolute",
  top: 180, // ズームボタンの下に配置
  right: 12,
  zIndex: 1000,
  backgroundColor: $isActive ? "#1976d2" : "white",
  color: $isActive ? "white" : "#1976d2",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  width: 40,
  height: 40,
  "&:hover": {
    backgroundColor: $isActive ? "#1565c0" : "#f5f5f5",
  },
  "&:disabled": {
    backgroundColor: "#f5f5f5",
    color: "#ccc",
  },
}));

const CurrentLocationButton: React.FC<CurrentLocationButtonProps> = ({
  onLocationToggle,
  disabled = false,
  isTracking = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled) return;

    setIsLoading(true);
    try {
      // トラッキング状態を切り替え
      onLocationToggle(!isTracking);
    } catch (error) {
      console.error("Location button error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LocationButton
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={isTracking ? "位置情報トラッキングを停止" : "位置情報トラッキングを開始"}
      $isActive={isTracking}
    >
      {isTracking ? <MyLocation /> : <LocationOff />}
    </LocationButton>
  );
};

export default CurrentLocationButton;
