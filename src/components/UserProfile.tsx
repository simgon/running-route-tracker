import React from 'react';
import { Button, Box } from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      // ログアウト後に画面をリロード
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Box>
      <Button
        onClick={handleSignOut}
        variant="text"
        startIcon={<LogoutIcon />}
        sx={{
          borderRadius: '4px',
          textTransform: 'none',
          fontWeight: 'normal',
          color: 'rgba(255, 255, 255, 0.8)',
          padding: '6px 12px',
          minWidth: 'auto',
          boxShadow: 'none',
          border: 'none',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            boxShadow: 'none',
          }
        }}
      >
        ログアウト
      </Button>

    </Box>
  );
};

export default UserProfile;