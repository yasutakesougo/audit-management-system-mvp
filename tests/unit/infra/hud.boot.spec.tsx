import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/spClient', () => import('../../mocks/sp.mock'));

import { render, screen } from '@testing-library/react';
import App from '@/App';
import { enableHudForTests } from '../../helpers/renderWithAppProviders';

describe('HUD bootstrap', () => {
  it('shows HUD status banner in test mode', async () => {
    enableHudForTests();
    render(<App />);

    const hudStatus = await screen.findByTestId('sp-connection-status');
    expect(hudStatus).toHaveTextContent(/SP (Connected|Sign[- ]?In|required)/i);
  });
});
