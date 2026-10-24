import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShellV2 } from './AppShellV2';

afterEach(() => {
  cleanup();
});

describe('AppShellV2 skip link contract', () => {
  it.each(['light', 'dark'] as const)('renders the same contract in %s mode', (mode) => {
    render(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <AppShellV2>{null}</AppShellV2>
      </ThemeProvider>,
    );

    const skipLink = screen.getByTestId('skip-to-main-link');
    const main = document.getElementById('app-main-content');

    expect(skipLink).toHaveAttribute('href', '#app-main-content');
    expect(main).not.toBeNull();
    expect(document.querySelectorAll('#app-main-content')).toHaveLength(1);
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves keyboard activation focus to the main content', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={createTheme()}>
        <AppShellV2>{null}</AppShellV2>
      </ThemeProvider>,
    );

    const skipLink = screen.getByTestId('skip-to-main-link');
    const main = document.getElementById('app-main-content');
    expect(main).not.toBeNull();

    await user.tab();
    expect(skipLink).toHaveFocus();
    fireEvent.click(skipLink);
    expect(main).toHaveFocus();
  });
});
