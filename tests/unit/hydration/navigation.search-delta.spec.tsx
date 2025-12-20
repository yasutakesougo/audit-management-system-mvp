import { render, screen } from '@testing-library/react';

import { createMemoryHistory } from 'history';
import React from 'react';

import { Navigation } from '../../../src/components/navigation/navigation';

/**
 * This is a test for the "hydration" case where the initial browser URL contains a query
 * string. We want to ensure that the navigation component properly reads the URL and
 * highlights the right section.
 */

describe('navigation hydration - search delta', () => {
  it('hydrates search delta and highlights the correct nav item', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/some/path?section=audits'],
    });

    render(<Navigation history={history} />);

    // Ensure that the correct section is highlighted.
    const auditsNavItem = screen.getByText('Audits');
    expect(auditsNavItem).toBeInTheDocument();

    // Hydration span should appear for audits.
    const hydrationSpan = screen.getByTestId('hydration-span-audits');
    expect(hydrationSpan).toBeInTheDocument();
  });
});
