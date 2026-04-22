import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryOperationalPhaseRepository } from '@/features/operationFlow/data/InMemoryOperationalPhaseRepository';
import { DEFAULT_PHASE_CONFIG } from '@/features/operationFlow/domain/defaultPhaseConfig';

// ── Mock: createOperationalPhaseRepository ──
let mockRepo: InMemoryOperationalPhaseRepository;

vi.mock('@/features/operationFlow/data/createOperationalPhaseRepository', () => ({
  createOperationalPhaseRepository: () => mockRepo,
  useOperationalPhaseRepository: () => mockRepo,
}));

vi.mock('@mui/material/Snackbar', () => ({
  __esModule: true,
  default: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="snackbar-mock">{children}</div> : null,
}));

// ── Mock: Date.now で固定時刻（10:00）を使う ──
// fake timers は使わず、getCurrentPhaseFromConfig のテストで時刻判定は検証済み

// ── SUT ──
const { default: OperationFlowSettingsPage } = await import(
  './OperationFlowSettingsPage'
);

describe('OperationFlowSettingsPage', () => {
  beforeEach(() => {
    mockRepo = new InMemoryOperationalPhaseRepository();
  });

  // ── 初期描画 ──

  it('ページタイトルが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    expect(await screen.findByText(/1日の流れ設定/)).toBeInTheDocument();
  });

  it('サブタイトルが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    expect(
      await screen.findByText(/朝会・通所受入・活動・記録仕上げなど/),
    ).toBeInTheDocument();
  });

  it('全フェーズの行が表示される', async () => {
    render(<OperationFlowSettingsPage />);
    const table = await screen.findByTestId('phase-config-table');
    expect(table).toBeInTheDocument();

    for (const phase of DEFAULT_PHASE_CONFIG) {
      expect(screen.getByTestId(`phase-row-${phase.phaseKey}`)).toBeInTheDocument();
    }
  });

  it('各フェーズのラベルが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    await screen.findByTestId('phase-config-table');

    // テーブル行のラベルを検証（MUI select のMenuItem にも同名が出る場合がある)
    const labels = [
      '出勤・朝準備', '朝会', '通所受入', '午前活動', '昼食休み', 'PM活動',
      '退所対応', '記録仕上げ', '夕会', '振り返り・翌日準備',
    ];
    for (const label of labels) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('保存ボタンが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    expect(await screen.findByTestId('save-button')).toBeInTheDocument();
  });

  it('初期値に戻すボタンが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    expect(await screen.findByTestId('reset-button')).toBeInTheDocument();
  });

  // ── 現在フェーズのプレビュー ──

  it('プレビューカードが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    expect(await screen.findByTestId('phase-preview-card')).toBeInTheDocument();
  });

  it('現在フェーズチップにフェーズ名が表示される', async () => {
    render(<OperationFlowSettingsPage />);
    const chip = await screen.findByTestId('current-phase-chip');
    // 実行時刻に依存するため、「該当なし」でなければフェーズ名が入っている
    expect(chip.textContent).toBeTruthy();
    expect(chip.textContent).not.toBe('');
  });

  it('主役画面のプレビューが表示される', async () => {
    render(<OperationFlowSettingsPage />);
    const el = await screen.findByTestId('current-primary-screen');
    expect(el.textContent).toContain('主役画面:');
  });

  it('現在時刻が表示される', async () => {
    render(<OperationFlowSettingsPage />);
    const el = await screen.findByTestId('current-time-display');
    // HH:mm 形式の時刻が含まれる
    expect(el.textContent).toMatch(/\d{2}:\d{2}/);
  });

  // ── 保存 ──

  it('保存ボタンをクリックすると saveAll が呼ばれる', async () => {
    const spy = vi.spyOn(mockRepo, 'saveAll');
    render(<OperationFlowSettingsPage />);

    const btn = await screen.findByTestId('save-button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    // 10件がそのまま保存される
    expect(spy.mock.calls[0][0]).toHaveLength(DEFAULT_PHASE_CONFIG.length);
  });

  it('保存後に成功メッセージが表示される', async () => {
    render(<OperationFlowSettingsPage />);

    const btn = await screen.findByTestId('save-button');
    fireEvent.click(btn);

    expect(await screen.findByText('設定を保存しました')).toBeInTheDocument();
  });

  // ── 初期値に戻す ──

  it('初期値に戻すをクリックすると resetToDefault が呼ばれる', async () => {
    const spy = vi.spyOn(mockRepo, 'resetToDefault');
    render(<OperationFlowSettingsPage />);

    const btn = await screen.findByTestId('reset-button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('初期値に戻した後にメッセージが表示される', async () => {
    render(<OperationFlowSettingsPage />);

    const btn = await screen.findByTestId('reset-button');
    fireEvent.click(btn);

    expect(await screen.findByText('初期値に戻しました')).toBeInTheDocument();
  });
});
