/**
 * Kiosk navigation utilities
 */

/**
 * Merges current search parameters with extra parameters.
 * Maintains existing parameters (like provider=memory, kiosk=1) while adding/overwriting new ones.
 */
export const mergeKioskSearchParams = (currentSearch: string, extraParams: Record<string, string> = {}): string => {
  const params = new URLSearchParams(currentSearch);
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  const search = params.toString();
  return search ? `?${search}` : '';
};

/**
 * Appends current search parameters to a base path.
 * Merges existing query parameters but clears specific user/slot state when navigating internally within kiosk.
 */
export const appendKioskSearchParams = (path: string, currentSearch: string, extraParams: Record<string, string> = {}): string => {
  const params = new URLSearchParams(currentSearch);
  
  // キオスクモード内での画面遷移時、以前の特定利用者のIDやスロット情報がクエリパラメータに
  // 残留し、他の利用者の画面への遷移がロックされてしまうバグを防ぐため自動的にクレンジングする。
  if (path.startsWith('/kiosk')) {
    params.delete('userId');
    params.delete('user');
    params.delete('slotId');
    params.delete('step');
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const search = params.toString();
  return `${path}${search ? `?${search}` : ''}`;
};
