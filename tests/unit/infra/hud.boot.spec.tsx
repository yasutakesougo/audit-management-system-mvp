import '../../mocks/sp.mock';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { enableHudForTests } from '../../helpers/renderWithAppProviders';

describe('HUD bootstrap', () => {
  it('exposes hydration spans in test mode', async () => {
    enableHudForTests();
    render(<App />);
    expect(await screen.findByTestId('hud-hydration')).toBeInTheDocument();
  });
});
