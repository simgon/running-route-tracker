import React from "react";
import { Box } from "@mui/material";

interface CrosshairOverlayProps {
  isCreationMode: boolean;
  isEditMode: boolean;
}

const CrosshairOverlay: React.FC<CrosshairOverlayProps> = ({
  isCreationMode,
  isEditMode,
}) => {
  if (!isCreationMode && !isEditMode) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          position: "relative",
          "&::before, &::after": {
            content: '""',
            position: "absolute",
            backgroundColor: "rgba(76, 175, 80, 0.8)",
            borderRadius: "2px",
            boxShadow: "0 0 8px rgba(0, 0, 0, 0.5)",
          },
          "&::before": {
            width: "3px",
            height: "30px",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
          },
          "&::after": {
            width: "30px",
            height: "3px",
            top: "50%",
            left: 0,
            transform: "translateY(-50%)",
          },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: 6,
          height: 6,
          backgroundColor: "rgba(76, 175, 80, 0.9)",
          borderRadius: "50%",
          border: "2px solid white",
          boxShadow: "0 0 6px rgba(0, 0, 0, 0.5)",
        }}
      />
    </Box>
  );
};

export default CrosshairOverlay;