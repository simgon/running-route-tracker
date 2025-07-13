import { useState } from 'react';

export const useStreetViewMode = () => {
  const [isStreetViewMode, setIsStreetViewMode] = useState(false);

  const handleStreetViewModeChange = (isVisible: boolean) => {
    setIsStreetViewMode(isVisible);
  };

  return {
    isStreetViewMode,
    handleStreetViewModeChange,
  };
};