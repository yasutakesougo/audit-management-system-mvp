import ChecklistPage from '@/features/compliance-checklist/ChecklistPage';
import type { ChecklistInsertDTO, ChecklistItem } from '@/features/compliance-checklist/types';
import * as audit from '@/lib/audit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

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

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ChecklistPage />
      </MemoryRouter>
    );

  it('shows legacy banner and back-to-home link', async () => {
    listMock.mockResolvedValue([]);

    renderPage();

    expect(screen.getByTestId('checklist-legacy-banner')).toBeInTheDocument();
    const backButton = screen.getByTestId('checklist-legacy-back');
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '/');
  });

  it('renders empty state when API returns no items', async () => {
    listMock.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: '監査チェックリスト' })).toBeInTheDocument();
    expect(screen.getByText('データがありません')).toBeInTheDocument();
    expect(addMock).not.toHaveBeenCalled();
  });

  it('submits new checklist item and logs audit entry', async () => {
    listMock.mockResolvedValue([]);
    const nextItem: ChecklistItem = {
      id: 'safety.plan',
      label: '安全計画',
      value: '安全計画の更新',
      note: '評価ロジック: value === "OK"',
    };
    addMock.mockImplementation(async (body: ChecklistInsertDTO) => ({
      id: body.RuleID,
      label: body.Title,
      value: body.RuleName ?? null,
      note: body.EvaluationLogic ?? null,
    }));
    const pushAuditSpy = vi.spyOn(audit, 'pushAudit').mockImplementation(() => undefined);
    renderPage();

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

    const firstMatchingInput = (labels: string[]): HTMLInputElement => {
      for (const label of labels) {
        const candidates = screen.queryAllByLabelText(label);
        if (candidates.length > 0) {
          return candidates[0] as HTMLInputElement;
        }
      }
      throw new Error(`input not found for labels: ${labels.join(', ')}`);
    };

    const titleInput = firstMatchingInput(['項目名', 'タイトル']);
    fireEvent.change(titleInput, { target: { value: nextItem.label } });
    fireEvent.change(firstMatchingInput(['キー', 'ルールID']), { target: { value: nextItem.id } });
    fireEvent.change(firstMatchingInput(['値', 'ルール名']), { target: { value: nextItem.value ?? '' } });
    fireEvent.change(firstMatchingInput(['備考', '評価ロジック']), { target: { value: nextItem.note ?? '' } });

    const submitButton = screen.getAllByRole('button', { name: '追加' }).find((btn) => !btn.hasAttribute('disabled'));
    if (!submitButton) {
      throw new Error('enabled submit button not found');
    }
    fireEvent.click(submitButton);

    await waitFor(() => expect(addMock).toHaveBeenCalledWith({
      Title: nextItem.label,
      RuleID: nextItem.id,
      RuleName: nextItem.value,
      EvaluationLogic: nextItem.note,
      SeverityLevel: 'INFO',
    }));

    expect(pushAuditSpy).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'current',
      action: 'checklist.create',
      entity: 'Compliance_CheckRules',
      entity_id: nextItem.id,
      channel: 'UI',
      after: expect.objectContaining({
        item: expect.objectContaining({
          id: nextItem.id,
          label: nextItem.label,
          value: nextItem.value,
          note: nextItem.note,
        }),
      }),
    }));

    expect(screen.getByText(nextItem.label)).toBeInTheDocument();
    expect(screen.getByText(`値: ${nextItem.value}`)).toBeInTheDocument();
    expect(screen.getByText(`備考: ${nextItem.note}`)).toBeInTheDocument();
    expect(titleInput.value).toBe('');

    pushAuditSpy.mockRestore();
  });
});
