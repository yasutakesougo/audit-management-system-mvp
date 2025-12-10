import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AppShell from '@/app/AppShell';
import { routerFutureFlags } from '@/app/routerFuture';
import { ThemeRoot } from '@/app/theme';
import { FeatureFlagsProvider, featureFlags } from '@/config/featureFlags';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

describe('AppShell theme toggle accessibility', () => {
  it('toggles aria-pressed when switching themes', () => {
    renderWithAppProviders(
      <ThemeRoot>
        <FeatureFlagsProvider value={featureFlags}>
          <AppShell>
            <div />
          </AppShell>
        </FeatureFlagsProvider>
      </ThemeRoot>,
      { future: routerFutureFlags }
    );

    const toggleButton = screen.getByRole('button', { name: /テーマ切り替え/ });

    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
  });
});
