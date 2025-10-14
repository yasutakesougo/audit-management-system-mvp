import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import ChecklistPage from '@/features/compliance-checklist/ChecklistPage';
import type { ChecklistItem, ChecklistInsertDTO } from '@/features/compliance-checklist/types';
import * as audit from '@/lib/audit';

const listMock = vi.fn<() => Promise<ChecklistItem[]>>();
const addMock = vi.fn<(body: ChecklistInsertDTO) => Promise<ChecklistItem>>();

vi.mock('@/features/compliance-checklist/api', () => ({
  useChecklistApi: () => ({
    list: listMock,
    add: addMock,
  }),
}));

describe('ChecklistPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    addMock.mockReset();
  });

  it('renders empty state when API returns no items', async () => {
    listMock.mockResolvedValue([]);

    render(<ChecklistPage />);

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: '監査チェックリスト' })).toBeInTheDocument();
    expect(screen.getByText('データがありません')).toBeInTheDocument();
    expect(addMock).not.toHaveBeenCalled();
  });

  it('submits new checklist item and logs audit entry', async () => {
    listMock.mockResolvedValue([]);
    const created: ChecklistItem = {
      id: 'safety.plan',
      label: '安全計画',
      value: '提出済み',
      note: '本社承認待ち',
    };
    addMock.mockImplementation(async (body: ChecklistInsertDTO) => ({
      id: body.cr013_key,
      label: body.Title,
      value: body.cr013_value ?? null,
      note: body.cr013_note ?? null,
    }));
  const pushAuditSpy = vi.spyOn(audit, 'pushAudit').mockImplementation(() => undefined);
    render(<ChecklistPage />);

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

  const byLabel = (label: string) => screen.getAllByLabelText(label)[0] as HTMLInputElement;
  const titleInput = byLabel('項目名');
  fireEvent.change(titleInput, { target: { value: created.label } });
  fireEvent.change(byLabel('キー'), { target: { value: created.id } });
  fireEvent.change(byLabel('値'), { target: { value: created.value ?? '' } });
  fireEvent.change(byLabel('備考'), { target: { value: created.note ?? '' } });

    const submitButton = screen.getAllByRole('button', { name: '追加' }).find((btn) => !btn.hasAttribute('disabled'));
    if (!submitButton) {
      throw new Error('enabled submit button not found');
    }
    fireEvent.click(submitButton);

    await waitFor(() => expect(addMock).toHaveBeenCalledWith({
      Title: created.label,
      cr013_key: created.id,
      cr013_value: created.value,
      cr013_note: created.note,
    }));

    expect(pushAuditSpy).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'current',
      action: 'checklist.create',
      entity: 'Compliance_Checklist',
      entity_id: created.id,
      channel: 'UI',
      after: expect.objectContaining({
        item: expect.objectContaining({
          id: created.id,
          label: created.label,
          value: created.value,
          note: created.note,
        }),
      }),
    }));

    expect(screen.getByText(created.label)).toBeInTheDocument();
    expect(screen.getByText(`値: ${created.value}`)).toBeInTheDocument();
    expect(screen.getByText(`備考: ${created.note}`)).toBeInTheDocument();
  expect(titleInput.value).toBe('');

    pushAuditSpy.mockRestore();
  });
});
