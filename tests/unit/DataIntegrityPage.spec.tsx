import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the hooks/modules before importing the component
vi.mock('@/hooks/useDataIntegrityScan', () => ({
  useDataIntegrityScan: vi.fn(),
}));

vi.mock('@/features/users/schema', () => ({
  SpUserMasterItemSchema: { safeParse: vi.fn(() => ({ success: true })) },
}));

vi.mock('@/features/daily/schema', () => ({
  SharePointDailyRecordItemSchema: { safeParse: vi.fn(() => ({ success: true })) },
}));

vi.mock('@/sharepoint/fields', () => ({
  USERS_SELECT_FIELDS_SAFE: ['Id', 'Title'],
}));

import { useDataIntegrityScan } from '@/hooks/useDataIntegrityScan';
import DataIntegrityPage from '@/pages/admin/DataIntegrityPage';

const mockUseDataIntegrityScan = vi.mocked(useDataIntegrityScan);

describe('DataIntegrityPage', () => {
  it('renders with scan button in idle state', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'idle',
      progress: null,
      results: [],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByTestId('data-integrity-page')).toBeDefined();
    expect(screen.getByTestId('scan-action-btn')).toBeDefined();
    expect(screen.getByText('スキャン開始')).toBeDefined();
  });

  it('shows progress during scanning', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'scanning',
      progress: { target: 'users', scanned: 50, total: 100, phase: 'validating' },
      results: [],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByTestId('scan-progress')).toBeDefined();
    expect(screen.getByText(/users をスキャン中/)).toBeDefined();
    expect(screen.getByText('スキャン中断')).toBeDefined();
  });

  it('shows success summary when all data is valid', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'done',
      progress: null,
      results: [
        { target: 'users', listTitle: 'Users_Master', total: 100, valid: 100, invalid: 0, issues: [], durationMs: 42, fetchStatus: 'success' },
      ],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByTestId('scan-summary')).toBeDefined();
    expect(screen.getByText(/すべてのデータが正常/)).toBeDefined();
    expect(screen.getByTestId('scan-results-table')).toBeDefined();
  });

  it('shows warning summary and issue details for invalid data', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'done',
      progress: null,
      results: [
        {
          target: 'users',
          total: 50,
          valid: 48,
          invalid: 2,
          issues: [
            { target: 'users', recordId: 101, messages: ['「氏名」は必須項目です'], zodIssues: [] },
            { target: 'users', recordId: 205, messages: ['想定外の値'], zodIssues: [] },
          ],
          durationMs: 15,
          fetchStatus: 'success',
          listTitle: 'Users_Master',
        },
      ],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByText(/2件の不整合/)).toBeDefined();
    expect(screen.getByTestId('issues-users')).toBeDefined();
    expect(screen.getByText('101')).toBeDefined();
    expect(screen.getByText('「氏名」は必須項目です')).toBeDefined();
  });

  it('shows error alert on scan failure', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'error',
      progress: null,
      results: [],
      error: 'Network timeout',
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByTestId('scan-error')).toBeDefined();
    expect(screen.getByText('Network timeout')).toBeDefined();
  });

  it('calls cancelScan when stop button clicked during scan', () => {
    const cancelScan = vi.fn();
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'scanning',
      progress: { target: 'users', scanned: 10, total: 100, phase: 'validating' },
      results: [],
      error: null,
      startScan: vi.fn(),
      cancelScan,
    });

    render(<DataIntegrityPage />);

    fireEvent.click(screen.getByTestId('scan-action-btn'));
    expect(cancelScan).toHaveBeenCalledOnce();
  });

  it('shows skipped-fields warning banner when any result has skippedFields', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'done',
      progress: null,
      results: [
        {
          target: 'users', listTitle: 'Users_Master', total: 33, valid: 33, invalid: 0,
          issues: [], durationMs: 10, fetchStatus: 'success', skippedFields: ['UserID'],
        },
      ],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.getByTestId('skipped-fields-banner')).toBeDefined();
    expect(screen.getByText(/列スキップが検出されました/)).toBeDefined();
    expect(screen.getByText(/persistent_drift/)).toBeDefined();
  });

  it('does not show skipped-fields warning banner when no result has skippedFields', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'done',
      progress: null,
      results: [
        {
          target: 'users', listTitle: 'Users_Master', total: 100, valid: 100, invalid: 0,
          issues: [], durationMs: 10, fetchStatus: 'success',
        },
      ],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    expect(screen.queryByTestId('skipped-fields-banner')).toBeNull();
  });

  it('shows repair link for rows with skippedFields and not for rows without', () => {
    mockUseDataIntegrityScan.mockReturnValue({
      status: 'done',
      progress: null,
      results: [
        {
          target: 'users', listTitle: 'Users_Master', total: 33, valid: 33, invalid: 0,
          issues: [], durationMs: 10, fetchStatus: 'success', skippedFields: ['UserID'],
        },
        {
          target: 'daily', listTitle: 'DailyActivityRecords', total: 10, valid: 10, invalid: 0,
          issues: [], durationMs: 5, fetchStatus: 'success',
        },
      ],
      error: null,
      startScan: vi.fn(),
      cancelScan: vi.fn(),
    });

    render(<DataIntegrityPage />);

    // users has skippedFields → link appears
    expect(screen.getByTestId('skipped-fields-link-users')).toBeDefined();
    expect(screen.getByText('構成診断を確認する →')).toBeDefined();
    // daily has no skippedFields → no link
    expect(screen.queryByTestId('skipped-fields-link-daily')).toBeNull();
  });
});
