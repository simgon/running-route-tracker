import React, { useState } from "react";
import { Dialog, DialogContent, Button, Box, Alert, Typography, Divider } from "@mui/material";
import { DirectionsRun } from "@mui/icons-material";
import { Google as GoogleIcon } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      onClose();
    } catch (error) {
      setError("Googleログインに失敗しました");
      console.error("Google sign in error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          padding: 2,
        },
      }}
    >
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
          px: 0,
        }}
      >
        {/* アプリタイトル */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <DirectionsRun sx={{ fontSize: "2rem", color: "#4caf50" }} />
          <Typography
            variant="h5"
            sx={{
              fontFamily: "Poppins, sans-serif",
              fontWeight: "600",
              color: "#333",
            }}
          >
            ランメモ
          </Typography>
        </Box>

        {/* 罫線 */}
        <Divider sx={{ width: "100%", mb: 3 }} />

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Button
            variant="text"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading}
            sx={{
              py: 2,
              px: 4,
              fontSize: "1.1rem",
              fontWeight: "normal",
              color: "#4285f4",
              borderRadius: 1,
              textTransform: "none",
              boxShadow: "none",
              border: "1px solid #e0e0e0",
              backgroundColor: "transparent",
              "&:hover": {
                backgroundColor: "rgba(66, 133, 244, 0.04)",
                boxShadow: "none",
                borderColor: "#4285f4",
              },
              "&:disabled": {
                color: "#ccc",
                borderColor: "#e0e0e0",
              },
            }}
          >
            {loading ? "ログイン中..." : "Googleでログイン"}
          </Button>

          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
