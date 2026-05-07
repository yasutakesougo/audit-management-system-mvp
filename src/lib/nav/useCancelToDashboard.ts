import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKioskDetection } from '@/features/settings/hooks/useKioskDetection';

export function useCancelToToday() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isKioskMode } = useKioskDetection();

  return useCallback(() => {
    // キオスクモードなら /kiosk へ、通常なら /today へ。クエリパラメータを維持。
    const target = isKioskMode ? '/kiosk' : '/today';
    navigate(`${target}${location.search}`, { replace: true });
  }, [navigate, isKioskMode, location.search]);
}

/** @deprecated Use useCancelToToday instead */
export const useCancelToDashboard = useCancelToToday;
