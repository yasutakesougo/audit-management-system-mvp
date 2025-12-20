import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';

vi.unmock('@/hydration/RouteHydrationListener');

describe('RouteHydrationListener invariants', () => {
  it('renders without crashing even without a router context', () => {
    expect(() => render(<RouteHydrationListener />)).toThrow(/requires a React Router context/i);
  });
});
