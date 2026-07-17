import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleFAB } from '../ScheduleFAB';

const renderFab = (canWrite = true) =>
  render(
    <ScheduleFAB
      canWrite={canWrite}
      onClick={vi.fn()}
      fabRef={createRef<HTMLButtonElement>()}
      resolvedActiveDateIso="2026-07-17"
      readOnlyMessage="閲覧のみです"
      fabInset="16px"
      fabInsetRight="16px"
    />,
  );

describe('ScheduleFAB', () => {
  it('keeps a 64 by 64 pixel touch target', () => {
    renderFab();

    const fab = screen.getByTestId('schedules-fab-create');
    expect(fab).toHaveStyle({
      width: '64px',
      minWidth: '64px',
      height: '64px',
      minHeight: '64px',
      borderRadius: '50%',
    });
  });

  it('announces the selected date when writable', () => {
    renderFab();

    expect(screen.getByTestId('schedules-fab-create')).toHaveAccessibleName(
      '選択中の日に予定を追加 (2026-07-17)',
    );
  });

  it('uses the read-only message and disables the button when not writable', () => {
    renderFab(false);

    const fab = screen.getByTestId('schedules-fab-create');
    expect(fab).toBeDisabled();
    expect(fab).toHaveAccessibleName('閲覧のみです');
  });
});
