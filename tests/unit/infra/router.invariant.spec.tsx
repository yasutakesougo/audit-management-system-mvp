import React from 'react';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteHydrationListener from '@/hydration/RouteHydrationListener';

vi.unmock('@/hydration/RouteHydrationListener');

describe('RouteHydrationListener invariants', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silence expected invariant noise for the negative test below.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('mounts inside a router context', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <RouteHydrationListener>
            <div>ok</div>
          </RouteHydrationListener>
        ),
      },
    ]);

    render(<RouterProvider router={router} />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('throws if rendered without a React Router context (expected)', () => {
    const suppressWindowError = (event: ErrorEvent) => {
      event.preventDefault();
    };
    window.addEventListener('error', suppressWindowError);

    class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error: Error) {
        return { error };
      }

      override componentDidCatch() {
        // no-op; console is already silenced by spies
      }

      override render() {
        if (this.state.error) {
          return <div data-testid="hydration-error">caught</div>;
        }
        return this.props.children;
      }
    }

    render(
      <ErrorBoundary>
        <RouteHydrationListener />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('hydration-error')).toBeInTheDocument();

    window.removeEventListener('error', suppressWindowError);
  });
});
