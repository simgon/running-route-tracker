import React from "react";
import { IconButton, Tooltip, Button, Box } from "@mui/material";
import { Help, Movie, Person, Logout as LogoutIcon } from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";

interface AppHeaderProps {
  enableRouteAnimation: boolean;
  onToggleAnimation: () => void;
  onShowHelp: () => void;
  onShowLogin: () => void;
  isStreetViewMode: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  enableRouteAnimation,
  onToggleAnimation,
  onShowHelp,
  onShowLogin,
  isStreetViewMode,
}) => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      // ログアウト後に画面をリロード
      window.location.reload();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };
  return (
    <header
      style={{
        display: isStreetViewMode ? "none" : "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 5px",
        width: "100%",
        flexDirection: "row",
        backgroundColor: "#282c34",
        color: "white",
        fontSize: "16px",
      }}
    >
      <div
        style={{
          textAlign: "left",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
        }}
        onClick={() => window.location.reload()}
      >
        <img 
          src="/logo192.png" 
          alt="ランメモ ロゴ" 
          style={{ 
            width: "28px", 
            height: "28px", 
            borderRadius: "4px" 
          }} 
        />
        <div>
          <h1
            style={{
              margin: "2px 0",
              fontSize: "1.1em",
              textAlign: "left",
              fontFamily: "Poppins, sans-serif",
              fontWeight: "600",
            }}
          >
            ランメモ
          </h1>
        </div>
      </div>

      {/* ヘルプボタンとユーザープロフィール/ログインボタン */}
      <div
        style={{
          textAlign: "right",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {/* アニメーションボタン */}
        <Tooltip
          title={
            enableRouteAnimation ? "ルートアニメーションを無効化" : "ルートアニメーションを有効化"
          }
        >
          <IconButton
            onClick={onToggleAnimation}
            sx={{
              color: enableRouteAnimation ? "#FF4444" : "rgba(255, 255, 255, 0.8)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: enableRouteAnimation ? "#FF6666" : "white",
              },
            }}
          >
            <Movie />
          </IconButton>
        </Tooltip>

        {/* ヘルプボタン */}
        <Tooltip title="ヘルプ">
          <IconButton
            onClick={onShowHelp}
            sx={{
              color: "rgba(255, 255, 255, 0.8)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "white",
              },
            }}
          >
            <Help />
          </IconButton>
        </Tooltip>

        {/* ユーザープロフィール */}
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="text"
            startIcon={<LogoutIcon />}
            sx={{
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: "normal",
              color: "rgba(255, 255, 255, 0.8)",
              padding: "6px 12px",
              minWidth: "auto",
              boxShadow: "none",
              border: "none",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "white",
                boxShadow: "none",
              },
            }}
          >
            ログアウト
          </Button>
        ) : (
          <button
            onClick={onShowLogin}
            style={{
              padding: "6px 12px",
              backgroundColor: "transparent",
              color: "rgba(255, 255, 255, 0.8)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "normal",
              boxShadow: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.color = "white";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
            }}
          >
            <Person style={{ fontSize: "18px" }} />
            ログイン
          </button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
