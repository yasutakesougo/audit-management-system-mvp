import * as React from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getInitialPreference = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  try {
    return window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
};

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState<boolean>(getInitialPreference);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(QUERY);
    const update = () => setPrefers(Boolean(mql.matches));
    update();

    try {
      mql.addEventListener('change', update);
      return () => {
        mql.removeEventListener('change', update);
      };
    } catch {
      // Legacy fallback for browsers without addEventListener on MediaQueryList.
      mql.addListener?.(update);
      return () => {
        mql.removeListener?.(update);
      };
    }
  }, []);

  return prefers;
}
