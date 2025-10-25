// src/utils/net.ts
export function shouldPrefetch(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const anyNavigator = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    } | null;
    mozConnection?: {
      saveData?: boolean;
      effectiveType?: string;
    } | null;
    webkitConnection?: {
      saveData?: boolean;
      effectiveType?: string;
    } | null;
  };

  const connection = anyNavigator.connection ?? anyNavigator.mozConnection ?? anyNavigator.webkitConnection;
  if (!connection) {
    return true;
  }

  const saveData = connection.saveData === true;
  const slow = typeof connection.effectiveType === 'string' && /^(2g|slow-2g)$/i.test(connection.effectiveType);
  return !(saveData || slow);
}
