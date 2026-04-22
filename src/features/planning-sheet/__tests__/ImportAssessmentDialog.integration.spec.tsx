/**
 * ImportAssessmentDialog.integration.spec.tsx
 *
 * 画面統合テスト: アセスメント → 支援計画シート取込ダイアログの
 * 完全な導線（モード選択 → プレビュー → provenance 表示 → 取込）を検証。
 *
 * テスト対象:
 *  1. ダイアログが開く
 *  2. アセスメント情報のプレビューが表示される
 *  3. 取込プレビューに変換根拠（provenance）が表示される
 *  4. 「取り込む」で onImport が正しい result（provenance 込み）で呼ばれる
 *  5. 変更なしの場合は「取り込む」が disabled
 *  6. モード切替で特性アンケート選択UIが出る
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import React from 'react';
import { ImportAssessmentDialog } from '../components/ImportAssessmentDialog';
import type { PlanningIntake, PlanningSheetFormValues } from '@/domain/isp/schema';
import type { UserAssessment, SensoryProfile } from '@/features/assessment/domain/types';
import type { AssessmentBridgeResult } from '../assessmentBridge';

// ---------------------------------------------------------------------------
// Mock: useTokuseiSurveyResponses（SharePoint アクセスを回避）
// ---------------------------------------------------------------------------

vi.mock('@/features/assessment/hooks/useTokuseiSurveyResponses', () => ({
  useTokuseiSurveyResponses: () => ({
    responses: [
      {
        id: 1,
        responseId: 'TOKUSEI-INT-001',
        responderName: '保護者テスト',
        fillDate: '2026-01-20T10:00:00Z',
        targetUserName: 'テスト太郎',
        createdAt: '2026-01-20T10:00:00Z',
        personality: '【対人関係の難しさ】初対面で緊張する',
        behaviorFeatures: '【変化への対応困難】予定変更でパニック',
        sensoryFeatures: '【聴覚】大きな音が苦手',
        strengths: '手先が器用',
        notes: 'テスト特記事項',
      },
    ],
    status: 'success' as const,
    error: null,
    refresh: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock: useSP（SharePoint client を回避）
// ---------------------------------------------------------------------------

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<any>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({
      web: { lists: { getByTitle: vi.fn() } },
    }),
    ensureConfig: () => ({ baseUrl: 'https://dummy.sharepoint.com' }),
  };
});

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeSensoryProfile = (overrides: Partial<SensoryProfile> = {}): SensoryProfile => ({
  visual: 3,
  auditory: 5,
  tactile: 3,
  olfactory: 3,
  vestibular: 3,
  proprioceptive: 4,
  ...overrides,
});

const makeAssessment = (overrides: Partial<UserAssessment> = {}): UserAssessment => ({
  id: 'test-assessment-int',
  userId: 'user-int-1',
  updatedAt: new Date().toISOString(),
  items: [
    { id: '1', category: 'body', topic: '睡眠', status: 'challenge', description: '中途覚醒あり' },
    { id: '2', category: 'activity', topic: '手先', status: 'strength', description: '細かい作業が得意' },
    { id: '3', category: 'environment', topic: '騒音', status: 'challenge', description: '教室が騒がしい' },
  ],
  sensory: makeSensoryProfile(),
  analysisTags: ['聴覚過敏', 'てんかんの既往', '手先が器用'],
  ...overrides,
});

const makeEmptyForm = (): PlanningSheetFormValues => ({
  userId: 'user-int-1',
  ispId: 'isp-int-1',
  title: '統合テスト計画シート',
  targetScene: '',
  targetDomain: '',
  observationFacts: '',
  collectedInformation: '',
  interpretationHypothesis: 'テスト仮説',
  supportIssues: 'テスト課題',
  supportPolicy: 'テスト方針',
  environmentalAdjustments: '',
  concreteApproaches: 'テスト具体策',
  status: 'draft',
  authoredByStaffId: '',
  authoredByQualification: 'unknown',
  applicableServiceType: 'other',
  applicableAddOnTypes: ['none'],
  hasMedicalCoordination: false,
  hasEducationCoordination: false,
  monitoringCycleDays: 90,
});

const makeEmptyIntake = (): PlanningIntake => ({
  presentingProblem: '',
  targetBehaviorsDraft: [],
  behaviorItemsTotal: null,
  incidentSummaryLast30d: '',
  communicationModes: [],
  sensoryTriggers: [],
  medicalFlags: [],
  consentScope: [],
  consentDate: null,
});

// ---------------------------------------------------------------------------
// Helper: ダイアログ描画
// ---------------------------------------------------------------------------

const TEST_MUI_THEME = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
    },
  },
});

function renderDialog(props: {
  assessment?: UserAssessment;
  currentForm?: PlanningSheetFormValues;
  currentIntake?: PlanningIntake;
  onImport?: (result: AssessmentBridgeResult) => void;
  targetUserName?: string;
}) {
  const onImport = props.onImport ?? vi.fn();
  const onClose = vi.fn();

  const result = render(
    <ThemeProvider theme={TEST_MUI_THEME}>
      <ImportAssessmentDialog
        open={true}
        onClose={onClose}
        assessment={props.assessment ?? makeAssessment()}
        targetUserName={props.targetUserName ?? 'テスト太郎'}
        currentForm={props.currentForm ?? makeEmptyForm()}
        currentIntake={props.currentIntake ?? makeEmptyIntake()}
        onImport={onImport}
      />
    </ThemeProvider>,
  );

  return { onImport, onClose, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportAssessmentDialog — 統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Step 1: ダイアログが開く ──
  it('ダイアログが開き、タイトルが表示される', () => {
    renderDialog({});
    expect(screen.getByText('アセスメントデータの取込')).toBeInTheDocument();
    expect(screen.getByText(/アセスメント画面のデータを支援計画シート/)).toBeInTheDocument();
  });

  // ── Step 2: アセスメント情報プレビュー ──
  it('アセスメントのアイテム数・タグ数・感覚プロファイルが表示される', () => {
    renderDialog({});
    expect(screen.getByText('アイテム: 3件')).toBeInTheDocument();
    expect(screen.getByText('タグ: 3件')).toBeInTheDocument();
    // 聴覚が5なので「過敏」と表示される（Chipとprovenanceの両方にマッチしうる）
    expect(screen.getByText('聴覚: 過敏')).toBeInTheDocument();
  });

  // ── Step 3: 取込プレビューに変更予告が表示される ──
  it('取込プレビューに感覚トリガー・行動観察・収集情報・医療フラグの変更が表示される', () => {
    renderDialog({});
    // 感覚トリガー（auditory: 5, proprioceptive: 4 → 2件）
    expect(screen.getByText(/感覚トリガー.*2件.*「情報収集」/)).toBeInTheDocument();
    // 行動観察
    expect(screen.getByText(/行動観察.*行動観察フィールド/)).toBeInTheDocument();
    // 収集情報
    expect(screen.getByText(/収集情報.*収集情報フィールド/)).toBeInTheDocument();
    // 医療フラグ
    expect(screen.getByText(/医療フラグ.*1件/)).toBeInTheDocument();
  });

  // ── Step 3b: 変換根拠（provenance）が表示される ──
  it('変換根拠セクションが表示され、各エントリの理由が見える', () => {
    renderDialog({});
    // 変換根拠ヘッダー
    expect(screen.getByText(/変換根拠/)).toBeInTheDocument();
    // 感覚プロファイル起因の provenance
    expect(screen.getByText(/聴覚スコア.*≥ 4.*過敏/)).toBeInTheDocument();
    // ICF 起因の provenance
    expect(screen.getByText(/身体機能カテゴリ.*1件.*行動観察/)).toBeInTheDocument();
    // 医療フラグ起因の provenance
    expect(screen.getByText(/医療関連キーワード.*てんかん/)).toBeInTheDocument();
  });

  // ── Step 4: 「取り込む」ボタンで onImport が呼ばれる ──
  it('「取り込む」ボタンでonImportが正しいresultで呼ばれる', () => {
    const onImport = vi.fn();
    renderDialog({ onImport });

    const importButton = screen.getByRole('button', { name: '取り込む' });
    expect(importButton).toBeEnabled();

    fireEvent.click(importButton);

    expect(onImport).toHaveBeenCalledTimes(1);
    const result: AssessmentBridgeResult = onImport.mock.calls[0][0];

    // formPatches を検証
    expect(result.formPatches.observationFacts).toContain('睡眠');
    expect(result.formPatches.observationFacts).toContain('手先');
    expect(result.formPatches.collectedInformation).toContain('騒音');

    // intakePatches を検証
    expect(result.intakePatches.sensoryTriggers!.length).toBeGreaterThanOrEqual(2);
    expect(result.intakePatches.medicalFlags).toContain('てんかんの既往');

    // provenance を検証
    expect(result.provenance.length).toBeGreaterThan(0);
    expect(result.provenance.some((p) => p.source === 'assessment_sensory')).toBe(true);
    expect(result.provenance.some((p) => p.source === 'assessment_icf')).toBe(true);
    expect(result.provenance.some((p) => p.source === 'assessment_tags')).toBe(true);
    // 全エントリに importedAt が設定されている
    expect(result.provenance.every((p) => p.importedAt)).toBe(true);
  });

  // ── Step 5: 変更なしの場合 ──
  it('既に取込済みの場合、「取り込む」が disabled になる', () => {
    const assessment = makeAssessment({
      sensory: {
        visual: 3, auditory: 3, tactile: 3,
        olfactory: 3, vestibular: 3, proprioceptive: 3,
      },
      items: [],
      analysisTags: [],
    });
    renderDialog({ assessment });

    const importButton = screen.getByRole('button', { name: '取り込む' });
    expect(importButton).toBeDisabled();
    // 「取り込める新規データがありません」の表示
    expect(screen.getByText(/取り込める新規データがありません/)).toBeInTheDocument();
  });

  // ── Step 6: モード切替 ──
  it('「アセスメント＋特性アンケート」モードに切替えると選択UIが表示される', () => {
    renderDialog({});

    // 初期はアセスメントのみモード
    const withTokuseiRadio = screen.getByLabelText('アセスメント＋特性アンケート');
    fireEvent.click(withTokuseiRadio);

    // 特性アンケート選択セクションが表示される
    expect(screen.getByText('特性アンケート回答の選択')).toBeInTheDocument();
    // モックされたアンケート回答が表示される
    expect(screen.getByText('テスト太郎')).toBeInTheDocument();
    expect(screen.getByText(/保護者テスト/)).toBeInTheDocument();
  });

  // ── Step 7: 特性アンケート選択 → provenance にアンケート出典が追加 ──
  it('特性アンケートを選択すると、provenanceにアンケート出典が追加される', () => {
    const onImport = vi.fn();
    renderDialog({ onImport });

    // 「アセスメント＋特性アンケート」モードに切替
    const withTokuseiRadio = screen.getByLabelText('アセスメント＋特性アンケート');
    fireEvent.click(withTokuseiRadio);

    // アンケート回答を選択
    const responseItem = screen.getByText('テスト太郎');
    fireEvent.click(responseItem);

    // 取込実行
    const importButton = screen.getByRole('button', { name: '取り込む' });
    fireEvent.click(importButton);

    const result: AssessmentBridgeResult = onImport.mock.calls[0][0];

    // tokusei_survey の provenance が含まれる
    const tokuseiProvenances = result.provenance.filter((p) => p.source === 'tokusei_survey');
    expect(tokuseiProvenances.length).toBeGreaterThanOrEqual(2);
    expect(tokuseiProvenances.some((p) => p.field === 'observationFacts')).toBe(true);
    expect(tokuseiProvenances.some((p) => p.field === 'collectedInformation')).toBe(true);
    expect(tokuseiProvenances[0].sourceLabel).toContain('保護者テスト');

    // 行動観察に特性アンケートのテキストが含まれる
    expect(result.formPatches.observationFacts).toContain('特性アンケート');
    expect(result.formPatches.observationFacts).toContain('保護者テスト');
    expect(result.formPatches.observationFacts).toContain('緊張する');
  });

  // ── Step 8: onClose が呼ばれる ──
  it('取込後にonCloseが呼ばれる', () => {
    const { onClose } = renderDialog({});

    const importButton = screen.getByRole('button', { name: '取り込む' });
    fireEvent.click(importButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const { onClose } = renderDialog({});

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
