import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProvidersAndRouter } from '@/tests/helpers/renderWithProvidersAndRouter';

import { Navigation } from '@/components/navigation/navigation';

describe('Navigation Search Delta (hydration)', () => {
  it('keeps spans when navigating between schedules day route', async () => {
    renderWithProvidersAndRouter(<Navigation />);

    // initial render
    const spans = screen.getAllByTestId('nav-span');
    expect(spans.length).toBeGreaterThan(0);

    // ensure the schedule day route span is present (can be delayed due to hydration)
    await waitFor(
      () => {
        const routeSpan = spans.find(
          (span) => span.getAttribute('data-span-id') === 'route:schedules:day'
        );
        expect(routeSpan).toBeTruthy();
      },
      { timeout: 10000 }
    );
  });
});
