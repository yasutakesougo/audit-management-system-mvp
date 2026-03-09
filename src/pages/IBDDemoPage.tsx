// ---------------------------------------------------------------------------
// IBD Demo Page — 強度行動障害支援コンポーネント デモ
// 全Phase 1-3 コンポーネントを1ページで確認可能
//
// Demo data is in ibdDemo.data.ts
// Section components are in IBDDemoSections.tsx
// ---------------------------------------------------------------------------
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

import {
    addABCRecord,
    addSPS,
    addSupervisionLog,
    canConfirmSPS,
    confirmSPS,
    getAllSPS,
    getExpiringSPSAlerts,
    getSupervisionCounter,
    incrementSupportCount,
    resetIBDStore,
} from '@/features/ibd/core/ibdStore';
import type { ABCRecord, SupervisionLog } from '@/features/ibd/core/ibdTypes';
import { PDCA_RECOMMENDATION_LABELS } from '@/features/ibd/core/ibdTypes';
import { useAuditEvidenceReport } from '@/features/ibd/core/reports/useAuditEvidenceReport';
import { toLocalDateISO } from '@/utils/getNow';

import { DEMO_SCENES, DEMO_USER_ID } from './ibdDemo.data';
import {
    ABCEntrySection,
    ABCSummarySection,
    AuditReportSection,
    ColorCardSection,
    ConfirmGuardSection,
    CounterSection,
    FeedbackSection,
    InterventionSection,
    PositiveBannerSection,
    QuickViewSection,
    SPSAlertsSection,
} from './IBDDemoSections';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const IBDDemoPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastAction, setLastAction] = useState<string>('');
  const [copiedAction, setCopiedAction] = useState<string>('');
  const [savedLogs, setSavedLogs] = useState<SupervisionLog[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<string>('');
  const [abcRecords, setAbcRecords] = useState<ABCRecord[]>([]);

  const { prepareReportData } = useAuditEvidenceReport(DEMO_USER_ID, 'デモ利用者 太郎');

  // Initialize demo data on first render
  const initDemoData = useCallback(() => {
    resetIBDStore();

    addSPS({
      id: 'demo-sps-1',
      userId: DEMO_USER_ID,
      version: '1.0',
      createdAt: '2025-12-01',
      updatedAt: '2025-12-01',
      status: 'draft',
      confirmedBy: null,
      confirmedAt: null,
      icebergModel: {
        observableBehaviors: ['自傷行為（手を噛む）', '大声で叫ぶ', '物を投げる'],
        underlyingFactors: ['感覚過敏（聴覚）', '見通しが持てない不安', 'コミュニケーション手段の不足'],
        environmentalAdjustments: ['イヤーマフの常時携帯', '視覚的スケジュールの提示', 'PECSによる意思表示支援'],
      },
      positiveConditions: ['穏やかな環境', '馴染みのスタッフ', '視覚的な見通し'],
    });
    confirmSPS('demo-sps-1', 100, '2025-12-01');

    incrementSupportCount(DEMO_USER_ID);
    incrementSupportCount(DEMO_USER_ID);

    setRefreshKey((k) => k + 1);
    setLastAction('デモデータを初期化しました');
  }, []);

  useEffect(() => {
    initDemoData();
  }, []);

  // Handlers
  const handleAddObservation = useCallback(() => {
    addSupervisionLog({
      id: `log-${Date.now()}`,
      userId: DEMO_USER_ID,
      supervisorId: 100,
      observedAt: toLocalDateISO(),
      notes: '安定した状態で活動参加。食事場面での工夫が効果的。',
      actionsTaken: ['計画通り支援を実施', '環境調整の効果を確認'],
    });
    setRefreshKey((k) => k + 1);
    setLastAction('✅ 観察ログを追加し、カウンターをリセットしました');
  }, []);

  const handleAddSupport = useCallback(() => {
    incrementSupportCount(DEMO_USER_ID);
    setRefreshKey((k) => k + 1);
    setLastAction('📝 支援記録を追加（カウンター +1）');
  }, []);

  const handleProcedureTap = useCallback((sceneLabel: string, action: string) => {
    setCopiedAction(`【${sceneLabel}】${action}`);
    setLastAction(`📋 記録にコピー: 【${sceneLabel}】${action}`);
  }, []);

  const handleConfirmCheck = useCallback(() => {
    const certified = canConfirmSPS(true);
    const uncertified = canConfirmSPS(false);
    setLastAction(
      `権限チェック結果:\n✅ 修了者: ${certified.allowed ? '確定可能' : certified.reason}\n❌ 非修了者: ${uncertified.allowed ? '確定可能' : uncertified.reason}`
    );
  }, []);

  const handleSaveObservation = useCallback((log: SupervisionLog) => {
    addSupervisionLog(log);
    setSavedLogs((prev) => [...prev, log]);
    setRefreshKey((k) => k + 1);
    setLastAction(
      `✅ PDCA観察ログを保存しました\n` +
      `遵守度: ${log.adherenceToManual ?? '未設定'}/5\n` +
      `発見した好条件: ${log.discoveredPositiveConditions?.join(', ') || 'なし'}\n` +
      `推奨: ${log.pdcaRecommendation ? PDCA_RECOMMENDATION_LABELS[log.pdcaRecommendation] : '未設定'}`
    );
  }, []);

  // Get current state for display
  const counter = getSupervisionCounter(DEMO_USER_ID);
  const allSPS = getAllSPS();
  const alerts = getExpiringSPSAlerts(90, toLocalDateISO());

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} data-testid="ibd-demo-page" key={refreshKey}>
      {/* ── ヘッダー ── */}
      <Stack spacing={2} sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          🧠 強度行動障害支援システム — デモ
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Phase 1-3 で実装した全コンポーネントを確認できます
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={initDemoData}>
            🔄 データ初期化
          </Button>
          <Button variant="contained" size="small" color="warning" onClick={handleAddSupport}>
            📝 支援記録追加 (カウンター+1)
          </Button>
          <Button variant="contained" size="small" color="success" onClick={handleAddObservation}>
            👁 観察ログ追加 (リセット)
          </Button>
          <Button variant="outlined" size="small" onClick={handleConfirmCheck}>
            🔐 権限チェック
          </Button>
        </Stack>
        {lastAction && (
          <Alert severity="info" sx={{ whiteSpace: 'pre-line' }}>
            {lastAction}
          </Alert>
        )}
      </Stack>

      <Stack spacing={4}>
        <SPSAlertsSection allSPS={allSPS} alerts={alerts} />
        <ConfirmGuardSection />
        <CounterSection userId={DEMO_USER_ID} counter={counter} />
        <ColorCardSection />
        <PositiveBannerSection />
        <QuickViewSection scenes={DEMO_SCENES} copiedAction={copiedAction} onProcedureTap={handleProcedureTap} />
        <FeedbackSection userId={DEMO_USER_ID} savedLogs={savedLogs} onSave={handleSaveObservation} />
        <AuditReportSection
          pdfLoading={pdfLoading}
          setPdfLoading={setPdfLoading}
          prepareReportData={prepareReportData}
          setLastAction={setLastAction}
        />
        <InterventionSection
          scenes={DEMO_SCENES}
          selectedIntervention={selectedIntervention}
          onSelect={(method) => {
            setSelectedIntervention(method.label);
            setLastAction(`💊 介入方法を選択: ${method.label}（${method.category}）`);
          }}
        />
        <ABCEntrySection
          userId={DEMO_USER_ID}
          selectedIntervention={selectedIntervention}
          onSave={(record) => {
            addABCRecord(record);
            setAbcRecords((prev) => [...prev, record]);
            setLastAction(
              `🔬 ABC記録を保存: ` +
              `A:${record.antecedent.slice(0, 20)}... ` +
              `B:${record.behavior.slice(0, 20)}... ` +
              `機能:${record.estimatedFunction ?? '未推定'}`
            );
          }}
        />
        <ABCSummarySection userId={DEMO_USER_ID} abcRecords={abcRecords} />
      </Stack>
    </Container>
  );
};

export default IBDDemoPage;
