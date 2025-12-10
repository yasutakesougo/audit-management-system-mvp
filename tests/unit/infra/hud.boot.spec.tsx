import '../../mocks/sp.mock';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { enableHudForTests } from '../../helpers/renderWithAppProviders';

describe('HUD bootstrap', () => {
  it('shows HUD status banner in test mode', async () => {
    enableHudForTests();
    render(<App />);

    const statuses = await screen.findAllByRole('status');
    const hudStatus = statuses.find((node) => node.textContent?.includes('SP Sign-In'));
    expect(hudStatus).toBeDefined();
    expect(hudStatus).toHaveTextContent(/SP Sign-In/i);
  });
});
