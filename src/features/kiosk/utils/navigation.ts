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
 */
export const appendKioskSearchParams = (path: string, currentSearch: string, extraParams: Record<string, string> = {}): string => {
  const search = mergeKioskSearchParams(currentSearch, extraParams);
  return `${path}${search}`;
};
