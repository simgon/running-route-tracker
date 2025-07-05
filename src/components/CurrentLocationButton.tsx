import React, { useState, useEffect } from 'react';
import { IconButton, styled } from '@mui/material';
import { MyLocation } from '@mui/icons-material';

interface CurrentLocationButtonProps {
  onLocationClick: () => void;
  disabled?: boolean;
}

const LocationButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 80,
  right: 16,
  zIndex: 1000,
  backgroundColor: 'white',
  color: '#1976d2',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
  '&:disabled': {
    backgroundColor: '#f5f5f5',
    color: '#ccc',
  },
}));

const CurrentLocationButton: React.FC<CurrentLocationButtonProps> = ({
  onLocationClick,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled) return;
    
    setIsLoading(true);
    try {
      await onLocationClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LocationButton
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label="現在位置を表示"
    >
      <MyLocation />
    </LocationButton>
  );
};

export default CurrentLocationButton;