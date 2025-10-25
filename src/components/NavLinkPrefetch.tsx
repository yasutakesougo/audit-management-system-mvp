// src/components/NavLinkPrefetch.tsx
import * as React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { prefetch } from '@/utils/prefetch';

export type NavLinkPrefetchProps = LinkProps & {
  preload?: () => Promise<unknown>;
  preloadKey?: string;
};

export const NavLinkPrefetch = React.forwardRef<HTMLAnchorElement, NavLinkPrefetchProps>(
  function NavLinkPrefetch({ preload, preloadKey, onMouseEnter, onTouchStart, ...rest }, forwardedRef) {
    const anchorRef = React.useRef<HTMLAnchorElement | null>(null);

    const triggerPrefetch = React.useCallback(() => {
      if (!preload || !preloadKey) {
        return;
      }
      prefetch(preload, preloadKey);
    }, [preload, preloadKey]);

    const handleMouseEnter = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) {
          triggerPrefetch();
        }
      },
      [onMouseEnter, triggerPrefetch],
    );

    const handleTouchStart = React.useCallback(
      (event: React.TouchEvent<HTMLAnchorElement>) => {
        onTouchStart?.(event);
        if (!event.defaultPrevented) {
          triggerPrefetch();
        }
      },
      [onTouchStart, triggerPrefetch],
    );

    React.useEffect(() => {
      if (!preload || !preloadKey) {
        return;
      }
      if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
        return;
      }
      const element = anchorRef.current;
      if (!element) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          triggerPrefetch();
          observer.disconnect();
        }
      }, { rootMargin: '200px' });

      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }, [preload, preloadKey, triggerPrefetch]);

    const setRef = React.useCallback(
      (node: HTMLAnchorElement | null) => {
        anchorRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    return (
      <Link
        {...rest}
        ref={setRef}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleTouchStart}
      />
    );
  },
);
