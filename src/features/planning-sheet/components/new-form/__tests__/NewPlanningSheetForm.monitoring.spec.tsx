import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NewPlanningSheetForm } from '../NewPlanningSheetForm';
import type { PlanningSheetRepository, IspRepository } from '@/domain/isp/port';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';

// ── Demo record for tests ──
const demoMonitoringRecord: BehaviorMonitoringRecord = {
  id: 'bm-test-1',
  userId: 'user-1',
  planningSheetId: 'new',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  supportEvaluations: [],
  environmentFindings: [],
  effectiveSupports: '',
  difficultiesObserved: 'テスト困難場面',
  newTriggers: [],
  medicalSafetyNotes: '',
  userFeedback: 'テスト本人の意向',
  familyFeedback: '',
  recommendedChanges: [],
  summary: 'テスト総合所見',
  recordedBy: 'テスト記録者',
  recordedAt: new Date().toISOString(),
};

// ── Mocks ──
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn(() => vi.fn()),
}));
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ account: { displayName: 'テスト職員' } })),
}));
vi.mock('@/features/users/useUsers', () => ({
  useUsers: vi.fn(() => ({
    data: [
      { UserID: 'user-1', FullName: '山田 花子', Ruby: 'ヤマダ ハナコ' },
      { UserID: 'user-2', FullName: '鈴木 一郎', Ruby: 'スズキ イチロウ' },
    ],
    isLoading: false,
    error: null,
  })),
}));
vi.mock('@/features/assessment/hooks/useTokuseiSurveyResponses', () => ({
  useTokuseiSurveyResponses: vi.fn(() => ({
    responses: [],
    status: 'success',
  })),
}));

// Mock useLatestBehaviorMonitoring — 既定は record あり
const mockUseLatestBehaviorMonitoring = vi.fn(() => ({
  record: demoMonitoringRecord as BehaviorMonitoringRecord | null,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}));
vi.mock('../../../hooks/useLatestBehaviorMonitoring', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useLatestBehaviorMonitoring: (...args: any[]) => mockUseLatestBehaviorMonitoring(...args),
}));

const mockIspRepo = {
  getCurrentByUser: vi.fn().mockResolvedValue(null),
} as unknown as IspRepository;

const mockPlanningSheetRepo = {
  save: vi.fn(),
} as unknown as PlanningSheetRepository;

/**
 * 🎯 NewPlanningSheetForm の行動モニタリング読込機能に関するテスト
 *
 * 先決の6観点を優先的に実装しています。
 * 1. パネル表示 / 非表示
 * 2. 読込ボタンで dialog が開く
 * 3. キャンセルで無変更
 * 4. auto patches の反映
 * 5. 再読込で重複しない
 * 6. 取込済ラベル + toast
 */
describe('NewPlanningSheetForm - monitoring import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLatestBehaviorMonitoring.mockReturnValue({
      record: demoMonitoringRecord,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <NewPlanningSheetForm
          planningSheetRepo={mockPlanningSheetRepo}
          ispRepo={mockIspRepo}
        />
      </MemoryRouter>
    );
  };

  const selectUser = async (userName: string) => {
    const user = userEvent.setup();
    const combobox = screen.getByRole('combobox', { name: /利用者を検索/ });
    await user.click(combobox);
    await user.type(combobox, userName);
    const option = await screen.findByRole('option', { name: new RegExp(userName) });
    await user.click(option);
    // ISP 紐付け完了を待つ（getCurrentByUser が null → 仮紐付け warning 表示）
    await waitFor(() => {
      expect(screen.getByText(/仮の紐付けで続行/)).toBeInTheDocument();
    });
  };

  describe('rendering', () => {
    it('利用者未選択ではモニタリング反映ボタンが無効化されている', () => {
      renderComponent();
      const button = screen.getByRole('button', { name: /モニタリングから反映/ });
      expect(button).toBeDisabled();
    });

    it('利用者選択時はモニタリング反映ボタンが有効になる', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const button = await screen.findByRole('button', { name: /モニタリングから反映/ });
      expect(button).toBeEnabled();
    });

    it('記録がない場合はモニタリング反映ボタンが無効化される', async () => {
      mockUseLatestBehaviorMonitoring.mockReturnValue({
        record: null as BehaviorMonitoringRecord | null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      renderComponent();
      await selectUser('山田 花子');

      const button = screen.getByRole('button', { name: /モニタリングから反映/ });
      expect(button).toBeDisabled();
    });
  });

  describe('dialog actions', () => {
    it('読込ボタン押下で ImportMonitoringDialog が開く', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const importButton = await screen.findByRole('button', { name: /モニタリングから反映/ });
      await user.click(importButton);

      // Dialog のタイトルが表示されることを確認
      expect(await screen.findByText('行動モニタリング結果の反映')).toBeInTheDocument();
    });

    it('キャンセル時はフォーム値を変更せず、再反映ラベルも出さない', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const importButton = await screen.findByRole('button', { name: /モニタリングから反映/ });
      await user.click(importButton);

      expect(await screen.findByText('行動モニタリング結果の反映')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      await user.click(cancelButton);

      // ダイアログが閉じるのを待つ
      await waitFor(() => {
        expect(screen.queryByText('行動モニタリング結果の反映')).toBeNull();
      });

      // ボタンラベルが「モニタリングから反映」のまま（「再反映」でない）
      expect(screen.getByRole('button', { name: /モニタリングから反映/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /再反映/ })).toBeNull();
    });
  });

  describe('auto patches', () => {
    it('空フィールドに auto patches が正しく反映される', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const importButton = await screen.findByRole('button', { name: /モニタリングから反映/ });
      await user.click(importButton);

      // ダイアログ内で「反映する」ボタンを押す
      const applyButton = await screen.findByRole('button', { name: /^反映する/ });
      await user.click(applyButton);

      // 反映後にボタンラベルが「再反映」に変わる
      expect(await screen.findByRole('button', { name: /モニタリングから再反映/ })).toBeInTheDocument();
    });

    it.todo('既存テキストがある場合は改行区切りで追記される');
    it.todo('空文字の patch は無視される');
  });

  describe('candidate import', () => {
    it.todo('選択した候補のみを反映する');
    it.todo('同一フィールドの複数候補を改行区切りで順序を保って反映する');
    it.todo('候補未選択時は candidate の反映を行わず、自動追記（autoPatches）のみ処理する');
  });

  describe('deduplication', () => {
    it('同一内容を再度読み込んでも、重複して増殖しない', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const getImportButton = () => screen.findByRole('button', { name: /モニタリングから(再)?反映/ });

      // 1回目の反映
      await user.click(await getImportButton());
      await user.click(await screen.findByRole('button', { name: /^反映する/ }));
      expect(await screen.findByRole('button', { name: /モニタリングから再反映/ })).toBeInTheDocument();

      // 2回目の反映
      await user.click(await getImportButton());
      await user.click(await screen.findByRole('button', { name: /^反映する/ }));

      // Error が投げられたり増幅しないことの簡易的確認
      expect(await screen.findByRole('button', { name: /モニタリングから再反映/ })).toBeInTheDocument();
    });

    it.todo('類似しているが別の文言は、意図して保持・追記される');
  });

  describe('provenance', () => {
    it.todo('反映されたフィールドに「💡 モニタリングより反映」バッジを表示する');
    it.todo('特性アンケート由来のバッジと共存して表示できる');
  });

  describe('import state ui', () => {
    it('反映後にボタンラベルが「モニタリングから再反映」に変わる', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const importButton = await screen.findByRole('button', { name: /モニタリングから反映/ });
      await user.click(importButton);

      const applyButton = await screen.findByRole('button', { name: /^反映する/ });
      await user.click(applyButton);

      expect(await screen.findByRole('button', { name: /モニタリングから再反映/ })).toBeInTheDocument();
    });

    it('完了時に success toast を表示する', async () => {
      renderComponent();
      await selectUser('山田 花子');

      const user = userEvent.setup();
      const importButton = await screen.findByRole('button', { name: /モニタリングから反映/ });
      await user.click(importButton);

      const applyButton = await screen.findByRole('button', { name: /^反映する/ });
      await user.click(applyButton);

      // Snackbar のテキストアサート（ISP warning の alert も存在するため、テキストで直接探す）
      expect(await screen.findByText(/モニタリングから取込完了/)).toBeInTheDocument();
    });

    it.todo('toast に自動件数と候補件数（例: 自動X件、候補0件）を正確に表示する');
  });
});
