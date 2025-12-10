import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type Options = {
  headingSelector?: string;
  fallbackTestId?: string;
  announce?: (message: string) => void;
  getHeadingMessage?: () => string | null;
  shouldRestore?: () => boolean;
};

export function useRouteFocusManager({
  headingSelector = '[data-page-heading="true"], [data-testid="page-heading"], h1[id$="heading"]',
  fallbackTestId,
  announce,
  getHeadingMessage,
  shouldRestore,
}: Options = {}): void {
  const { pathname, search } = useLocation();
  const lastKeyRef = useRef('');

  useEffect(() => {
    const key = `${pathname}${search}`;
    if (lastKeyRef.current === key) {
      return;
    }

    lastKeyRef.current = key;

    const restore = (() => {
      const explicit = shouldRestore?.();
      if (typeof explicit === 'boolean') {
        return explicit;
      }
      if (typeof window === 'undefined') {
        return true;
      }
      const scope = window as typeof window & { __routeFocusRestore__?: boolean };
      return scope.__routeFocusRestore__ !== false;
    })();

    const heading = document.querySelector(headingSelector) as HTMLElement | null;
    let skipHeadingFocus = false;
    if (typeof window !== 'undefined') {
      const scope = window as typeof window & { __skipRouteHeadingFocus__?: boolean };
      skipHeadingFocus = scope.__skipRouteHeadingFocus__ ?? false;
      scope.__skipRouteHeadingFocus__ = false;
    }
    if (heading) {
      heading.setAttribute('tabindex', heading.getAttribute('tabindex') ?? '-1');
      if (restore && !skipHeadingFocus) {
        heading.focus({ preventScroll: true });
      }
    }

    if (announce) {
      const message = getHeadingMessage?.() ?? heading?.textContent ?? null;
      if (message) {
        announce(message);
      }
    }

    if (!restore || !fallbackTestId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && active !== heading) {
        return;
      }

      const target = document.querySelector(`[data-testid="${fallbackTestId}"]`) as HTMLElement | null;
      target?.focus({ preventScroll: true });
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [announce, fallbackTestId, getHeadingMessage, headingSelector, pathname, search, shouldRestore]);
}
