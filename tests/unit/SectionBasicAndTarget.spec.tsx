import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SectionBasicAndTarget } from '@/features/planning-sheet/components/new-form/sections/SectionBasicAndTarget';
import { INITIAL_FORM } from '@/features/planning-sheet/components/new-form/constants';

describe('SectionBasicAndTarget', () => {
  it('支援開始日が未入力の場合に警告を表示する', () => {
    render(
      <SectionBasicAndTarget
        step={0}
        form={{ ...INITIAL_FORM, supportStartDate: '' }}
        updateField={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/未入力のまま保存すると保存日で補完されます/),
    ).toBeInTheDocument();
  });

  it('支援開始日が入力済みの場合は警告を表示しない', () => {
    render(
      <SectionBasicAndTarget
        step={0}
        form={{ ...INITIAL_FORM, supportStartDate: '2026-05-01' }}
        updateField={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/未入力のまま保存すると保存日で補完されます/),
    ).not.toBeInTheDocument();
  });
});
