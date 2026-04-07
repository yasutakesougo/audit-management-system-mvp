import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpIndexPressurePanel } from '../SpIndexPressurePanel';
import * as hooks from '../useSpIndexCandidates';
import * as repairHooks from '../useSpIndexRepair';
import * as confirmHooks from '@/components/ui/useConfirmDialog';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../useSpIndexCandidates', () => ({
  useSpIndexCandidates: vi.fn(),
}));

vi.mock('../useSpIndexRepair', () => ({
  useSpIndexRepair: vi.fn(),
}));

vi.mock('@/components/ui/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn(),
}));

describe('SpIndexPressurePanel: UI Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    vi.mocked(repairHooks.useSpIndexRepair).mockReturnValue({
      generatePlan: vi.fn(),
      executeRepair: vi.fn(),
      plan: null,
      results: [],
      isExecuting: false,
      isConfirmed: false,
      setConfirmed: vi.fn(),
      reset: vi.fn(),
    });

    vi.mocked(confirmHooks.useConfirmDialog).mockReturnValue({
      open: vi.fn(),
      close: vi.fn(),
      dialogProps: {
        open: false,
        title: '',
        message: '',
        warningText: undefined,
        severity: 'warning',
        confirmLabel: 'OK',
        cancelLabel: 'キャンセル',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        busy: false,
      },
    });
  });

  it('should render nothing when there are no candidates (Healthy state)', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    const { container } = render(<SpIndexPressurePanel listName="HealthyList" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render Urgent section when additionCandidates exist', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [
        { internalName: 'UrgentField', displayName: '至急列', reason: '5000件エラー回避' },
      ],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    render(<SpIndexPressurePanel listName="AlertList" />);

    // Check for Urgent header and "Repair Now" button (newly added)
    expect(screen.getByText(/至急対応が必要/)).toBeTruthy();
    expect(screen.getByText(/至急列/)).toBeTruthy();
    expect(screen.getByText(/5000件エラー回避/)).toBeTruthy();
    expect(screen.getByText(/今すぐ修復/)).toBeTruthy();
  });

  it('should trigger repair confirmation flow when "Repair Now" is clicked', () => {
    const mockGeneratePlan = vi.fn();
    const mockOpen = vi.fn();

    vi.mocked(repairHooks.useSpIndexRepair).mockReturnValue({
      ...vi.mocked(repairHooks.useSpIndexRepair)(),
      generatePlan: mockGeneratePlan,
    });

    vi.mocked(confirmHooks.useConfirmDialog).mockReturnValue({
      ...vi.mocked(confirmHooks.useConfirmDialog)(),
      open: mockOpen,
    });

    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [
        { internalName: 'FieldA', displayName: '列A', reason: 'R1' },
      ],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    render(<SpIndexPressurePanel listName="RepairTestList" />);

    const repairBtn = screen.getByText(/今すぐ修復/);
    fireEvent.click(repairBtn);

    expect(mockGeneratePlan).toHaveBeenCalledWith('RepairTestList', expect.any(Array), expect.any(Array));
    expect(mockOpen).toHaveBeenCalled();
  });

  it('should render results section when results exist', () => {
    vi.mocked(repairHooks.useSpIndexRepair).mockReturnValue({
      ...vi.mocked(repairHooks.useSpIndexRepair)(),
      results: [
        { 
          action: { type: 'create', listName: 'L', internalName: 'F', displayName: '表示名', reason: 'R' }, 
          status: 'success', 
          timestamp: 'now' 
        },
      ],
    });

    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: null,
    });

    render(<SpIndexPressurePanel listName="ResultList" />);

    expect(screen.getByText(/修復が完了しました/)).toBeTruthy();
    expect(screen.getAllByText(/OK/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/表示名/).length).toBeGreaterThan(0);
  });

  it('should handle error state gracefully', () => {
    vi.mocked(hooks.useSpIndexCandidates).mockReturnValue({
      currentIndexed: [],
      deletionCandidates: [],
      additionCandidates: [],
      hasKnownConfig: true,
      loading: false,
      error: 'API Timeout',
    });

    render(<SpIndexPressurePanel listName="ErrorList" />);
    expect(screen.getByText(/インデックス解析に失敗しました/)).toBeTruthy();
    expect(screen.getByText(/API Timeout/)).toBeTruthy();
  });
});
