import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChecklistApi } from '../../src/features/compliance-checklist/api';
import type { ChecklistInsertDTO, ChecklistItemDTO } from '../../src/features/compliance-checklist/types';

const getListItemsByTitle = vi.fn();
const addListItemByTitle = vi.fn();

vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({ getListItemsByTitle, addListItemByTitle })
}));

describe('useChecklistApi', () => {
  beforeEach(() => {
    getListItemsByTitle.mockReset();
    addListItemByTitle.mockReset();
  });

  it('list maps DTO to domain shape', async () => {
    const dto: ChecklistItemDTO = {
      Id: 1,
      Title: 'Row',
      RuleID: 'k',
      RuleName: 'Row',
      EvaluationLogic: 'v',
      ValidFrom: '2025-01-01',
      ValidTo: null,
      SeverityLevel: 'WARN',
    };
    getListItemsByTitle.mockResolvedValueOnce([dto]);
    const { result } = renderHook(() => useChecklistApi());
    const rows = await result.current.list();
    expect(rows[0]).toEqual({ id: 'k', label: 'Row', value: 'v', note: null, required: undefined, severityLevel: 'WARN', validFrom: '2025-01-01', validTo: null });
  });

  it('add returns mapped created item', async () => {
    const createdDto: ChecklistItemDTO = {
      Id: 5,
      Title: 'New',
      RuleID: 'k2',
      RuleName: 'New',
      EvaluationLogic: 'v2',
      ValidFrom: null,
      ValidTo: null,
      SeverityLevel: 'INFO',
    };
    addListItemByTitle.mockResolvedValueOnce(createdDto);
    const { result } = renderHook(() => useChecklistApi());
    const payload: ChecklistInsertDTO = {
      Title: 'New',
      RuleID: 'k2',
      RuleName: 'New',
      EvaluationLogic: 'v2',
    };
    const created = await result.current.add(payload);
    expect(created).toEqual({ id: 'k2', label: 'New', value: 'v2', note: null, required: undefined, severityLevel: 'INFO', validFrom: null, validTo: null });
  });
});
