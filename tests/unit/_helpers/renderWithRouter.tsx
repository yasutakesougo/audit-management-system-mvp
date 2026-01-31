import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Renders a component wrapped in MemoryRouter to provide React Router context.
 * Use this for components that use useNavigate(), useLocation(), or other router hooks.
 */
export function renderWithRouter(
  ui: React.ReactElement,
  options?: { initialEntries?: string[] } & Omit<RenderOptions, 'wrapper'>
) {
  const { initialEntries = ['/'], ...renderOptions } = options || {};
  
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
    renderOptions
  );
}
