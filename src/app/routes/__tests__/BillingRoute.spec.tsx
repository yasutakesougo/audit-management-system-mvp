import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BillingRoute from '../BillingRoute';

const state = vi.hoisted(() => ({
  repository: { kind: 'billing-repository' },
}));

vi.mock('@/features/billing', () => ({
  useBillingRuntime: () => state.repository,
  BillingPage: ({ repository }: { repository: unknown }) => (
    <div data-testid="billing-route-repository">
      {repository === state.repository ? 'injected' : 'unexpected'}
    </div>
  ),
}));

describe('BillingRoute', () => {
  it('injects the public runtime repository into BillingPage', () => {
    render(<BillingRoute />);

    expect(screen.getByTestId('billing-route-repository')).toHaveTextContent('injected');
  });
});
