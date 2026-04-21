import { useLocation } from 'react-router-dom';
import { useSettingsContext } from '../SettingsContext';
import { useMemo } from 'react';

/**
 * useKioskDetection — キオスクモード判定の SSOT
 * 
 * 優先順位:
 * 1. URLパラメータ (?kiosk=1) -> 最優先 (即時反映)
 * 2. Settings (layoutMode === 'kiosk') -> 永続状態
 * 
 * このフックにより、状態伝播の遅延（Race Condition）に関わらず、
 * URLにkiosk=1があれば初回フレームからキオスク表示を強制できる。
 */
export function useKioskDetection() {
  const { settings } = useSettingsContext();
  const location = useLocation();

  const isKioskMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const kioskParam = params.get('kiosk');
    
    // URLパラメータがあればそれを優先
    if (kioskParam === '1' || kioskParam === 'true') return true;
    if (kioskParam === '0' || kioskParam === 'false') return false;
    
    // パラメータがなければ設定に従う
    return settings.layoutMode === 'kiosk';
  }, [location.search, settings.layoutMode]);

  return { isKioskMode };
}
