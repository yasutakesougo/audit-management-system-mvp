import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RouteHydrationListener from '@/hydration/RouteHydrationListener';

describe('RouteHydrationListener invariants', () => {
  it('throws when rendered without a router context', () => {
    expect(() => render(<RouteHydrationListener />)).toThrow(/React Router context/);
  });
});
