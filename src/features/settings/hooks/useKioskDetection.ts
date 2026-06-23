import { useLocation } from 'react-router-dom';
import { useSettingsContext } from '../SettingsContext';
import { useMemo } from 'react';

/**
 * useKioskDetection — キオスク表示判定の SSOT
 *
 * 優先順位:
 * 1. /kiosk 配下のルート -> キオスク表示を強制
 * 2. URLパラメータ (?kiosk=1 / ?kiosk=true) -> 通常ルートでもキオスク表示を強制
 * 3. URLパラメータ (?kiosk=0 / ?kiosk=false) -> 明示的な非キオスク表示
 * 4. Settings (layoutMode === 'kiosk') -> 手動選択された永続状態
 *
 * SettingsDialog 側では、OFF 操作時に強制条件を解除するため、
 * ?kiosk クエリ削除や /kiosk ルートからの退避を行う。
 */
export function useKioskDetection() {
  const { settings } = useSettingsContext();
  const location = useLocation();

  const isKioskMode = useMemo(() => {
    // 1. パスによる判定 (/kiosk ルートは常にキオスクモード)
    if (location.pathname.startsWith('/kiosk')) return true;

    const params = new URLSearchParams(location.search);
    const kioskParam = params.get('kiosk');
    
    // 2. URLパラメータがあればそれを優先
    if (kioskParam === '1' || kioskParam === 'true') return true;
    if (kioskParam === '0' || kioskParam === 'false') return false;
    
    // 3. パラメータがなければ設定に従う
    return settings.layoutMode === 'kiosk';
  }, [location.pathname, location.search, settings.layoutMode]);

  return { isKioskMode };
}
