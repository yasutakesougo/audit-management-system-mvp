import '../../mocks/sp.mock';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
