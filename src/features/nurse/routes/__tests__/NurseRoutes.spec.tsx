import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { nurseRoutes } from '../NurseRoutes';

function renderWithRoute(url: string) {
  const router = createMemoryRouter([nurseRoutes()], {
    initialEntries: [url],
  });
  return render(<RouterProvider router={router} />);
}

describe('NurseObservationPage ?user= contract', () => {
  it('displays passed user from query parameter', () => {
    renderWithRoute('/nurse/observation?user=I022');

    expect(screen.getByText(/利用者.*I022/)).toBeInTheDocument();
  });

  it('falls back to I000 when no user query is provided', () => {
    renderWithRoute('/nurse/observation');

    expect(screen.getByText(/利用者.*I000/)).toBeInTheDocument();
  });
});
