import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsProvider } from '@/features/settings/SettingsContext';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    initialEntries?: string[];
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'>
) {
  const { initialEntries = ['/'], queryClient = createTestQueryClient(), ...renderOptions } = options || {};

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </SettingsProvider>
    </QueryClientProvider>,
    renderOptions
  );
}
