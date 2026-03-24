/**
 * useNetworkStatus — Online/Offline 状態を監視するフック
 *
 * 用途:
 *   - KioskStatusBar でネットワーク状態を表示
 *   - OfflineBanner で接続断を通知
 *
 * Returns:
 *   - isOnline: boolean
 *   - wasOffline: 直前にオフラインだったか（復帰検知用）
 */
import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  // SSR fallback — assume online
  return true;
}

export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Track "was offline" for recovery toast
  const [wasOffline, setWasOffline] = useState(false);
  const prevOnlineRef = { current: isOnline };

  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      setWasOffline(true);
      // Auto-clear after 5 seconds
      const timer = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timer);
    }
    if (!isOnline) {
      prevOnlineRef.current = false;
    }
  }, [isOnline]);

  return { isOnline, wasOffline };
}
