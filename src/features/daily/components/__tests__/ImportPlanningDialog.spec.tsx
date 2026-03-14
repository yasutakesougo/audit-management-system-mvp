/**
 * ImportPlanningDialog.spec.tsx — 支援計画シートから手順取込ダイアログのテスト
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPlanningDialog } from '../procedure/ImportPlanningDialog';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/ProcedureRepository';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeSheet = (overrides: Partial<SupportPlanningSheet> = {}): SupportPlanningSheet => ({
  id: 'sheet-1',
  userId: 'user-1',
  ispId: 'isp-1',
  title: 'テスト支援計画シート',
  targetScene: '',
  targetDomain: '',
  observationFacts: '行動観察テキスト',
  collectedInformation: '',
  interpretationHypothesis: '仮説テキスト',
  supportIssues: '支援課題テキスト',
  supportPolicy: '声掛けは穏やかに行う\n指示は短文で伝える',
  environmentalAdjustments: '照明を調整する',
  concreteApproaches: '挨拶は目線を合わせて行う\n活動切替3分前に予告する',
  appliedFrom: null,
  nextReviewAt: null,
  authoredByStaffId: '',
  authoredByQualification: 'unknown',
  authoredAt: null,
  applicableServiceType: 'other',
  applicableAddOnTypes: ['none'],
  deliveredToUserAt: null,
  reviewedAt: null,
  hasMedicalCoordination: false,
  hasEducationCoordination: false,
  supportStartDate: null,
  monitoringCycleDays: 90,
  regulatoryBasisSnapshot: {
    supportLevel: null,
    behaviorScore: null,
    serviceType: null,
    eligibilityCheckedAt: null,
  },
  status: 'active',
  isCurrent: true,
  intake: {
    presentingProblem: '',
    targetBehaviorsDraft: [],
    behaviorItemsTotal: null,
    incidentSummaryLast30d: '',
    communicationModes: [],
    sensoryTriggers: ['聴覚過敏'],
    medicalFlags: ['てんかんの既往'],
    consentScope: [],
    consentDate: null,
  },
  assessment: {
    targetBehaviors: [],
    abcEvents: [],
    hypotheses: [],
    riskLevel: 'low',
    healthFactors: [],
    teamConsensusNote: '',
  },
  planning: {
    supportPriorities: [],
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
    procedureSteps: [],
    crisisThresholds: null,
    restraintPolicy: 'prohibited_except_emergency',
    reviewCycleDays: 180,
  },
  createdAt: '2026-01-01T00:00:00',
  createdBy: 'test',
  updatedAt: '2026-01-01T00:00:00',
  updatedBy: 'test',
  version: 1,
  ...overrides,
});

const emptySteps: ProcedureStep[] = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportPlanningDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onImport: vi.fn(),
    existingSteps: emptySteps,
    planningSheet: makeSheet(),
  };

  it('ダイアログタイトルを表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText('支援計画シートから手順を取込')).toBeInTheDocument();
  });

  it('取込元シート名を表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/テスト支援計画シート/)).toBeInTheDocument();
  });

  it('追加されるステップ数を表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    // 方針2 + 具体策2 + 環境1 = 5ステップ（ボタンとプレビュー見出しに表示）
    const matches = screen.getAllByText(/5件/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('支援方針のプレビューを表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/声掛けは穏やかに行う/)).toBeInTheDocument();
    expect(screen.getByText(/指示は短文で伝える/)).toBeInTheDocument();
  });

  it('具体的対応のプレビューを表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/挨拶は目線を合わせて行う/)).toBeInTheDocument();
  });

  it('環境調整のプレビューを表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/照明を調整する/)).toBeInTheDocument();
  });

  it('全ステップ共通注記に感覚トリガーと医療フラグが表示される', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/聴覚過敏/)).toBeInTheDocument();
    expect(screen.getByText(/てんかんの既往/)).toBeInTheDocument();
  });

  it('変換根拠のChipが表示される', () => {
    render(<ImportPlanningDialog {...defaultProps} />);
    expect(screen.getByText(/変換根拠/)).toBeInTheDocument();
  });

  it('「取り込む」ボタンでonImportが呼ばれ、ダイアログが閉じる', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<ImportPlanningDialog {...defaultProps} onImport={onImport} onClose={onClose} />);

    const importBtn = screen.getByRole('button', { name: /取り込む/ });
    await user.click(importBtn);

    expect(onImport).toHaveBeenCalledTimes(1);
    const result = onImport.mock.calls[0][0];
    expect(result.steps).toHaveLength(5);
    expect(result.provenance.length).toBeGreaterThan(0);
    expect(result.globalNotes).toContain('聴覚過敏');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('planningSheet が null のとき警告メッセージを表示する', () => {
    render(<ImportPlanningDialog {...defaultProps} planningSheet={null} />);
    expect(screen.getByText(/紐づく支援計画シートが見つかりません/)).toBeInTheDocument();
  });

  it('全て取込済みのとき globalNotes のみ表示される', () => {
    const existingSteps: ProcedureStep[] = [
      { time: '', activity: '支援方針', instruction: '声掛けは穏やかに行う', isKey: true },
      { time: '', activity: '支援方針', instruction: '指示は短文で伝える', isKey: true },
      { time: '', activity: '具体的対応', instruction: '挨拶は目線を合わせて行う', isKey: false },
      { time: '', activity: '具体的対応', instruction: '活動切替3分前に予告する', isKey: false },
      { time: '', activity: '環境調整（留意点）', instruction: '【環境調整】照明を調整する', isKey: false },
    ];
    render(<ImportPlanningDialog {...defaultProps} existingSteps={existingSteps} />);
    // ステップは全て重複だが、globalNotes（感覚/医療）は常に表示される
    const matches = screen.getAllByText(/全ステップ共通注記/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // 取り込むボタンは引き続き有効（globalNotesがあるため isEmpty にならない）
    const importBtn = screen.getByRole('button', { name: /取り込む/ });
    expect(importBtn).not.toBeDisabled();
  });

  it('キャンセルボタンでonCloseが呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportPlanningDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
