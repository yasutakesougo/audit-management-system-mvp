import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCancelToDashboard() {
  const navigate = useNavigate();
  return useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);
}
