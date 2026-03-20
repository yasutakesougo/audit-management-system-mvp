import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCancelToToday() {
  const navigate = useNavigate();
  return useCallback(() => {
    navigate('/today', { replace: true });
  }, [navigate]);
}

/** @deprecated Use useCancelToToday instead */
export const useCancelToDashboard = useCancelToToday;
