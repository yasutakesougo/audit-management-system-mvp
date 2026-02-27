// ---------------------------------------------------------------------------
// IBD Demo Page — 強度行動障害支援コンポーネント デモ
// 全Phase 1-3 コンポーネントを1ページで確認可能
// ---------------------------------------------------------------------------
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';

import ABCEntryForm from '@/features/ibd/components/ABCEntryForm';
import ABCSummaryReport from '@/features/ibd/components/ABCSummaryReport';
import InterventionPickerPanel from '@/features/ibd/components/InterventionPickerPanel';
import ObservationFeedbackPanel from '@/features/ibd/components/ObservationFeedbackPanel';
import PositiveConditionsBanner from '@/features/ibd/components/PositiveConditionsBanner';
import SceneQuickView from '@/features/ibd/components/SceneQuickView';
import SupervisionCounterBadge from '@/features/ibd/components/SupervisionCounterBadge';
import {
    addABCRecord,
    addSPS,
    addSupervisionLog,
    canConfirmSPS,
    confirmSPS,
    getABCRecordsForUser,
    getAllSPS,
    getExpiringSPSAlerts,
    getSupervisionCounter,
    incrementSupportCount,
    resetIBDStore,
} from '@/features/ibd/ibdStore';
import type { ABCRecord, SupervisionLog, SupportScene } from '@/features/ibd/ibdTypes';
import { PDCA_RECOMMENDATION_LABELS, SUPPORT_CATEGORY_CONFIG } from '@/features/ibd/ibdTypes';
import { AuditEvidenceReportPDF } from '@/features/ibd/reports/AuditEvidenceReportPDF';
import { useAuditEvidenceReport } from '@/features/ibd/reports/useAuditEvidenceReport';

// ---------------------------------------------------------------------------
// デモデータ
// ---------------------------------------------------------------------------

const DEMO_SCENES: SupportScene[] = [
  {
    id: 'scene-arrival',
    sceneType: 'arrival',
    label: '朝の来所',
    iconKey: 'DirectionsWalk',
    positiveConditions: [
      '馴染みのスタッフが出迎える',
      '視覚的スケジュールが提示されている',
      '静かな環境（BGMなし）',
    ],
    procedures: [
      { order: 1, personAction: '玄関で立ち止まる', supporterAction: '名前を呼んで笑顔で出迎え、荷物置き場を指差す', stage: 'proactive' },
      { order: 2, personAction: '荷物を置いてスケジュールを確認', supporterAction: '写真カードで本日の流れを提示', stage: 'proactive' },
      { order: 3, personAction: '不安な表情を見せる', supporterAction: '好きな活動カードを見せて選択肢を提示', stage: 'earlyResponse' },
    ],
  },
  {
    id: 'scene-meal',
    sceneType: 'meal',
    label: '食事',
    iconKey: 'Restaurant',
    positiveConditions: [
      '決まった席に着席',
      '周囲の音が少ない',
      '好みのメニューが事前にわかっている',
    ],
    procedures: [
      { order: 1, personAction: '席に着いて待つ', supporterAction: 'メニュー写真カードを提示し、食べる順番を視覚化', stage: 'proactive' },
      { order: 2, personAction: '食べ物を投げようとする', supporterAction: '静かに「おしまいカード」を提示し、クールダウンスペースへ誘導', stage: 'crisisResponse' },
    ],
  },
  {
    id: 'scene-activity',
    sceneType: 'activity',
    label: '活動',
    iconKey: 'SportsEsports',
    positiveConditions: [
      '活動の見通しが持てている',
      '適切な難易度の課題',
      'タイマーで終了時刻が明確',
    ],
    procedures: [
      { order: 1, personAction: '活動に取り組む', supporterAction: 'タイマーを設定し残り時間を視覚化', stage: 'proactive' },
      { order: 2, personAction: '課題を拒否する', supporterAction: '選択肢（別の活動）を2つ提示', stage: 'earlyResponse' },
    ],
  },
  {
    id: 'scene-panic',
    sceneType: 'panic',
    label: 'パニック時',
    iconKey: 'Warning',
    positiveConditions: [
      'クールダウンスペースが確保されている',
      '応援スタッフの連絡体制が整っている',
    ],
    procedures: [
      { order: 1, personAction: '大声を出す・物を叩く', supporterAction: '安全距離を確保（2m以上）、周囲の利用者を避難', stage: 'crisisResponse' },
      { order: 2, personAction: '徐々に落ち着く', supporterAction: '静かに水を差し出す、好きなアイテムをそばに置く', stage: 'postCrisis' },
    ],
  },
  {
    id: 'scene-departure',
    sceneType: 'departure',
    label: '帰宅準備',
    iconKey: 'Home',
    positiveConditions: [
      '帰りの流れが視覚化されている',
      '送迎車両の到着時刻が伝わっている',
    ],
    procedures: [
      { order: 1, personAction: '荷物をまとめる', supporterAction: 'チェックリストカードで忘れ物確認を促す', stage: 'proactive' },
    ],
  },
];

const DEMO_USER_ID = 42;

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

    // Add a confirmed SPS that is near its review date
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

    // Add some support count (simulate 2 unobserved supports)
    incrementSupportCount(DEMO_USER_ID);
    incrementSupportCount(DEMO_USER_ID);

    setRefreshKey((k) => k + 1);
    setLastAction('デモデータを初期化しました');
  }, []);

  // Initialize on mount
  useState(() => {
    initDemoData();
  });

  // Handlers
  const handleAddObservation = useCallback(() => {
    addSupervisionLog({
      id: `log-${Date.now()}`,
      userId: DEMO_USER_ID,
      supervisorId: 100,
      observedAt: new Date().toISOString().split('T')[0],
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
  const alerts = getExpiringSPSAlerts(90, new Date().toISOString().split('T')[0]);

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
        {/* ── セクション 1: SPS アラート ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              📊 SPS 更新アラート
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              確定済みSPSの3ヶ月（90日）更新期限を監視。confirmedAt を起算点として計算。
            </Typography>

            <Stack spacing={2}>
              {allSPS.map((sps) => (
                <Paper key={sps.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      label={sps.status}
                      color={sps.status === 'confirmed' ? 'success' : 'default'}
                      size="small"
                    />
                    <Typography variant="body2">
                      作成: {sps.createdAt} | 確定: {sps.confirmedAt ?? '未確定'} | 次回見直し: {sps.nextReviewDueDate}
                    </Typography>
                  </Stack>
                </Paper>
              ))}

              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <Alert key={alert.sps.id} severity={alert.level === 'error' ? 'error' : 'warning'}>
                    SPS「{alert.sps.id}」: 残り {alert.daysRemaining}日
                    {alert.daysRemaining < 0 && ` (${Math.abs(alert.daysRemaining)}日超過)`}
                  </Alert>
                ))
              ) : (
                <Alert severity="success">アラートなし — 全SPSが期限内です</Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 2: canConfirm ガード ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              🔐 SPS確定操作の権限制御
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              実践研修修了者のみがSPSを確定可能。非修了者は下書き作成のみ。
            </Typography>

            <Stack direction="row" spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                <Typography variant="subtitle1" fontWeight={600}>実践研修修了者</Typography>
                <Chip label="確定可能" color="success" size="small" />
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
                <LockIcon color="error" sx={{ fontSize: 40 }} />
                <Typography variant="subtitle1" fontWeight={600}>基礎研修 / 未修了</Typography>
                <Chip label="確定不可" color="error" size="small" />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  {canConfirmSPS(false).reason}
                </Typography>
              </Paper>
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 3: 観察カウンター ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              👁 観察義務カウンター（2回に1回ルール）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              現在の未観察回数: <strong>{counter.supportCount}回</strong>
              {counter.lastObservedAt && ` | 最終観察: ${counter.lastObservedAt}`}
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>コンパクト表示:</Typography>
                <SupervisionCounterBadge userId={DEMO_USER_ID} />
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>詳細バナー表示:</Typography>
                <SupervisionCounterBadge userId={DEMO_USER_ID} detailed />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 4: カラーカード体系 ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              🎨 カラーカード体系
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              支援種別を3色で直感的に分類。手順ステップは左ボーダーの色でカテゴリを示す。
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {(Object.entries(SUPPORT_CATEGORY_CONFIG) as [string, typeof SUPPORT_CATEGORY_CONFIG[keyof typeof SUPPORT_CATEGORY_CONFIG]][]).map(
                ([key, config]) => (
                  <Paper
                    key={key}
                    variant="outlined"
                    sx={{
                      p: 2,
                      flex: 1,
                      borderLeft: 4,
                      borderLeftColor: config.color,
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: config.color }}>
                      {config.label}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {config.examples.map((ex) => (
                        <Chip key={ex} label={ex} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                )
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 5: 良い状態の条件バナー ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              ✅ 良い状態の条件バナー
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              各場面の冒頭に配置。予防的支援の意識を定着させる。
            </Typography>

            <Stack spacing={2}>
              <Typography variant="subtitle2">通常表示:</Typography>
              <PositiveConditionsBanner
                conditions={['静かな環境', '視覚的スケジュールの提示', '馴染みのスタッフ', 'イヤーマフ使用可能']}
                sceneName="来所時"
              />
              <Typography variant="subtitle2">コンパクト表示:</Typography>
              <PositiveConditionsBanner
                conditions={['決まった席', '静かな環境']}
                sceneName="食事"
                compact
              />
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 6: 場面別クイックビュー ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              📋 場面別クイックビュー
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              アイコンをタップして場面を切替。各場面の冒頭に「良い状態の条件」を配置。
              手順ステップをタップすると記録画面に内容をコピー。
            </Typography>

            {copiedAction && (
              <Alert severity="success" sx={{ mb: 2 }}>
                📋 コピー済み: {copiedAction}
              </Alert>
            )}

            <SceneQuickView scenes={DEMO_SCENES} onProcedureTap={handleProcedureTap} />
          </CardContent>
        </Card>

        {/* ── セクション 7: PDCA 観察フィードバックパネル ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              📝 PDCA 観察フィードバック
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              観察ログを「証跡」から「支援改善のトリガー」へ。手順書遵守度、新たな好条件の発見、
              手順書更新の提案をPDCAサイクルに接続。
            </Typography>

            <ObservationFeedbackPanel
              userId={DEMO_USER_ID}
              userName="デモ利用者 太郎"
              supervisorId={100}
              onSave={handleSaveObservation}
            />

            {savedLogs.length > 0 && (
              <Stack spacing={1} sx={{ mt: 3 }}>
                <Typography variant="subtitle2" fontWeight={600}>保存済みログ:</Typography>
                {savedLogs.map((log) => (
                  <Paper key={log.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2">
                      {log.observedAt} | 遵守度: {log.adherenceToManual ?? '-'}/5
                      {log.pdcaRecommendation && ` | ${PDCA_RECOMMENDATION_LABELS[log.pdcaRecommendation]}`}
                    </Typography>
                    {log.discoveredPositiveConditions && log.discoveredPositiveConditions.length > 0 && (
                      <Typography variant="caption" color="success.main">
                        発見: {log.discoveredPositiveConditions.join(', ')}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ── セクション 8: 監査エビデンスレポート ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              📄 監査エビデンスレポート
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              SPS確定履歴・観察ログ・遵守状況サマリをA4 PDFで出力。
              実地指導用のエビデンスとして1クリックでダウンロード。
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                size="large"
                startIcon={pdfLoading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                disabled={pdfLoading}
                onClick={async () => {
                  setPdfLoading(true);
                  try {
                    const { pdf } = await import('@react-pdf/renderer');
                    const reportData = prepareReportData('デモ管理者');
                    const blob = await pdf(<AuditEvidenceReportPDF data={reportData} />).toBlob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `IBD_監査エビデンス_デモ利用者太郎_${new Date().toISOString().split('T')[0]}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setLastAction('✅ 監査エビデンスレポートをダウンロードしました');
                  } catch (err) {
                    console.error('PDF generation error:', err);
                    setLastAction(`❌ PDF生成エラー: ${err instanceof Error ? err.message : String(err)}`);
                  } finally {
                    setPdfLoading(false);
                  }
                }}
                data-testid="download-audit-pdf"
              >
                {pdfLoading ? 'PDF生成中...' : '📄 監査レポートをダウンロード'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                A4 × 2ページ（SPS履歴 + 観察ログ）
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* ── セクション 9: 介入方法ピッカー (D-1) ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              💊 介入方法ピッカー
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              支援手順書のステップをカテゴリ色付きで展開。1タップで支援記録に引用。
            </Typography>

            {selectedIntervention && (
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ 選択済み介入: {selectedIntervention}
              </Alert>
            )}

            <InterventionPickerPanel
              scenes={DEMO_SCENES}
              onSelect={(method) => {
                setSelectedIntervention(method.label);
                setLastAction(`💊 介入方法を選択: ${method.label}（${method.category}）`);
              }}
            />
          </CardContent>
        </Card>

        {/* ── セクション 10: ABC分析入力 (D-2) ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              🔬 ABC分析 セット入力
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A(先行事象)・B(行動)・C(結果)をセットで記録。
              行動の機能（要求/回避/注目/感覚）を推定し、代替行動の学習につなげる。
            </Typography>

            <ABCEntryForm
              userId={DEMO_USER_ID}
              recordedBy={100}
              interventionUsed={selectedIntervention || undefined}
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
          </CardContent>
        </Card>

        {/* ── セクション 11: ABC集計レポート (D-3) ── */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              📊 ABC集計レポート
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              蓄積されたABCデータを分析。行動の機能分析とPBSに基づく代替行動の推奨。
            </Typography>

            <ABCSummaryReport records={abcRecords.length > 0 ? abcRecords : getABCRecordsForUser(DEMO_USER_ID)} />
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default IBDDemoPage;
