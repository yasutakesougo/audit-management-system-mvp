
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpIndexPressurePanel } from '../SpIndexPressurePanel';
import type { SpHealthSignal } from '../../spHealthSignalStore';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockExecute = vi.fn();

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({}),
}));

vi.mock('../spIndexRemediationService', () => ({
  executeIndexRemediation: (...args: unknown[]) => mockExecute(...args),
}));

// Default: 1 addition candidate, 0 deletion candidates
const mockCandidates = {
  currentIndexed: [{ internalName: 'RecordDate', displayName: 'Record Date', typeAsString: 'DateTime', deletionReason: '' }],
  deletionCandidates: [],
  additionCandidates: [{ internalName: 'RecordDate', displayName: 'Record Date', reason: '$filter=RecordDate' }],
  hasKnownConfig: true,
  loading: false,
  error: null,
};

vi.mock('../useSpIndexCandidates', () => ({
  useSpIndexCandidates: () => mockCandidates,
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

const SIGNAL: SpHealthSignal = {
  severity: 'warning',
  reasonCode: 'sp_index_pressure',
  listName: 'AttendanceDaily',
  message: 'インデックス逼迫',
  occurrenceCount: 1,
  occurredAt: '2026-04-06T00:00:00.000Z',
  source: 'nightly_patrol',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SpIndexPressurePanel — remediation action button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panel only when signal is sp_index_pressure', () => {
    const { rerender } = render(<SpIndexPressurePanel signal={null} />);
    expect(screen.queryByText(/Self-Healing 候補/)).toBeNull();

    rerender(<SpIndexPressurePanel signal={SIGNAL} />);
    expect(screen.getByText(/Self-Healing 候補/)).toBeTruthy();
  });

  it('shows remediation button for addition candidates', () => {
    render(<SpIndexPressurePanel signal={SIGNAL} />);
    expect(screen.getByRole('button', { name: /インデックス追加/ })).toBeTruthy();
  });

  it('calls executeIndexRemediation with correct args including source: ui', async () => {
    mockExecute.mockResolvedValue({ ok: true, message: 'done', action: 'create', listTitle: 'AttendanceDaily', internalName: 'RecordDate', timestamp: '' });

    render(<SpIndexPressurePanel signal={SIGNAL} />);
    fireEvent.click(screen.getByRole('button', { name: /インデックス追加/ }));

    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));
    expect(mockExecute).toHaveBeenCalledWith(
      expect.anything(),
      { listTitle: 'AttendanceDaily', internalName: 'RecordDate', action: 'create', source: 'ui' },
    );
  });

  it('disables button and shows success message after successful remediation', async () => {
    mockExecute.mockResolvedValue({ ok: true, message: 'done', action: 'create', listTitle: 'AttendanceDaily', internalName: 'RecordDate', timestamp: '' });

    render(<SpIndexPressurePanel signal={SIGNAL} />);
    fireEvent.click(screen.getByRole('button', { name: /インデックス追加/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /完了/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /完了/ })).toBeDisabled();
    expect(screen.getByText(/インデックスを追加しました/)).toBeTruthy();
  });

  it('shows duplicate_action message without disabling permanently', async () => {
    mockExecute.mockResolvedValue({
      ok: false,
      code: 'duplicate_action',
      message: 'already done',
      action: 'create',
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      timestamp: '',
    });

    render(<SpIndexPressurePanel signal={SIGNAL} />);
    fireEvent.click(screen.getByRole('button', { name: /インデックス追加/ }));

    await waitFor(() =>
      expect(screen.getByText(/このフィールドはこのセッションですでに修復済みです/)).toBeTruthy()
    );
    // button should remain enabled (user can retry tomorrow or after refresh)
    expect(screen.getByRole('button', { name: /インデックス追加/ })).not.toBeDisabled();
  });

  it('shows daily_limit_exceeded message', async () => {
    mockExecute.mockResolvedValue({
      ok: false,
      code: 'daily_limit_exceeded',
      message: 'over limit',
      action: 'create',
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      timestamp: '',
    });

    render(<SpIndexPressurePanel signal={SIGNAL} />);
    fireEvent.click(screen.getByRole('button', { name: /インデックス追加/ }));

    await waitFor(() =>
      expect(screen.getByText(/本日の自動修復上限/)).toBeTruthy()
    );
  });

  it('disables all row buttons while one is in flight', async () => {
    // simulate slow async
    const successResult = { ok: true as const, message: 'done', action: 'create' as const, listTitle: 'AttendanceDaily', internalName: 'RecordDate', timestamp: '' };
    let resolve!: (value: typeof successResult) => void;
    mockExecute.mockReturnValue(new Promise<typeof successResult>((r) => { resolve = r; }));

    // Use two candidates
    const origCandidates = mockCandidates.additionCandidates;
    mockCandidates.additionCandidates = [
      { internalName: 'RecordDate', displayName: 'Record Date', reason: 'x' },
      { internalName: 'Status', displayName: 'Status', reason: 'y' },
    ];

    render(<SpIndexPressurePanel signal={SIGNAL} />);
    const buttons = screen.getAllByRole('button', { name: /インデックス追加/ });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    // While in-flight, the other button should also be disabled
    await waitFor(() => expect(buttons[1]).toBeDisabled());

    await waitFor(() => resolve(successResult));
    // Restore
    mockCandidates.additionCandidates = origCandidates;
  });
});
