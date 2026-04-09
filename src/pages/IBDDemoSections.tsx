/**
 * IBD Demo Page — Section Components
 *
 * All 11 demo sections extracted from IBDDemoPage.tsx.
 * Each section is a standalone Card component that receives only the
 * data/callbacks it needs via props.
 *
 * @module pages/IBDDemoSections
 */

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
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ABCEntryForm from '@/features/ibd/core/components/ABCEntryForm';
import ABCSummaryReport from '@/features/ibd/core/components/ABCSummaryReport';
import InterventionPickerPanel from '@/features/ibd/core/components/InterventionPickerPanel';
import ObservationFeedbackPanel from '@/features/ibd/core/components/ObservationFeedbackPanel';
import PositiveConditionsBanner from '@/features/ibd/core/components/PositiveConditionsBanner';
import SceneQuickView from '@/features/ibd/core/components/SceneQuickView';
import SupervisionCounterBadge from '@/features/ibd/core/components/SupervisionCounterBadge';

import {
    canConfirmSPS,
    getABCRecordsForUser,
} from '@/features/ibd/core/ibdStore';
import type { ABCRecord, SupervisionLog, SupportScene } from '@/features/ibd/core/ibdTypes';
import { PDCA_RECOMMENDATION_LABELS, SUPPORT_CATEGORY_CONFIG } from '@/features/ibd/core/ibdTypes';

import { auditLog } from '@/lib/debugLogger';
import { toLocalDateISO } from '@/utils/getNow';

// ── Section 1: 支援計画シート アラート ──

interface SPSAlertsSectionProps {
  allSPS: Array<{
    id: string;
    status: string;
    createdAt: string;
    confirmedAt: string | null;
    nextReviewDueDate?: string;
  }>;
  alerts: Array<{
    sps: { id: string };
    level: string;
    daysRemaining: number;
  }>;
}

export function SPSAlertsSection({ allSPS, alerts }: SPSAlertsSectionProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          📊 支援計画シート 更新アラート
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          確定済み支援計画シートの3ヶ月（90日）更新期限を監視。confirmedAt を起算点として計算。
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
                支援計画シート「{alert.sps.id}」: 残り {alert.daysRemaining}日
                {alert.daysRemaining < 0 && ` (${Math.abs(alert.daysRemaining)}日超過)`}
              </Alert>
            ))
          ) : (
            <Alert severity="success">アラートなし — 全支援計画シートが期限内です</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Section 2: canConfirm ガード ──

export function ConfirmGuardSection() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          🔐 支援計画シート確定操作の権限制御
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          実践研修修了者のみが支援計画シートを確定可能。非修了者は下書き作成のみ。
        </Typography>

        <Stack direction="row" spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
            <Typography variant="subtitle1" component="span" fontWeight={600}>実践研修修了者</Typography>
            <Chip label="確定可能" color="success" size="small" />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <LockIcon color="error" sx={{ fontSize: 40 }} />
            <Typography variant="subtitle1" component="span" fontWeight={600}>基礎研修 / 未修了</Typography>
            <Chip label="確定不可" color="error" size="small" />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {canConfirmSPS(false).reason.replace(/SPS/g, '支援計画シート')}
            </Typography>
          </Paper>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Section 3: 観察カウンター ──

interface CounterSectionProps {
  userId: number;
  counter: { supportCount: number; lastObservedAt: string | null };
}

export function CounterSection({ userId, counter }: CounterSectionProps) {
  return (
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
            <Typography variant="subtitle2" component="span" sx={{ mb: 1 }}>コンパクト表示:</Typography>
            <SupervisionCounterBadge userId={userId} />
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" component="span" sx={{ mb: 1 }}>詳細バナー表示:</Typography>
            <SupervisionCounterBadge userId={userId} detailed />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Section 4: カラーカード体系 ──

export function ColorCardSection() {
  return (
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
                <Typography variant="subtitle1" component="span" fontWeight={600} sx={{ color: config.color }}>
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
  );
}

// ── Section 5: 良い状態の条件バナー ──

export function PositiveBannerSection() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          ✅ 良い状態の条件バナー
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          各場面の冒頭に配置。予防的支援の意識を定着させる。
        </Typography>

        <Stack spacing={2}>
          <Typography variant="subtitle2" component="span">通常表示:</Typography>
          <PositiveConditionsBanner
            conditions={['静かな環境', '視覚的スケジュールの提示', '馴染みのスタッフ', 'イヤーマフ使用可能']}
            sceneName="来所時"
          />
          <Typography variant="subtitle2" component="span">コンパクト表示:</Typography>
          <PositiveConditionsBanner
            conditions={['決まった席', '静かな環境']}
            sceneName="食事"
            compact
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Section 6: 場面別クイックビュー ──

interface QuickViewSectionProps {
  scenes: SupportScene[];
  copiedAction: string;
  onProcedureTap: (sceneLabel: string, action: string) => void;
}

export function QuickViewSection({ scenes, copiedAction, onProcedureTap }: QuickViewSectionProps) {
  return (
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

        <SceneQuickView scenes={scenes} onProcedureTap={onProcedureTap} />
      </CardContent>
    </Card>
  );
}

// ── Section 7: PDCA 観察フィードバックパネル ──

interface FeedbackSectionProps {
  userId: number;
  savedLogs: SupervisionLog[];
  onSave: (log: SupervisionLog) => void;
}

export function FeedbackSection({ userId, savedLogs, onSave }: FeedbackSectionProps) {
  return (
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
          userId={userId}
          userName="デモ利用者 太郎"
          supervisorId={100}
          onSave={onSave}
        />

        {savedLogs.length > 0 && (
          <Stack spacing={1} sx={{ mt: 3 }}>
            <Typography variant="subtitle2" component="span" fontWeight={600}>保存済みログ:</Typography>
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
  );
}

// ── Section 8: 監査エビデンスレポート ──

interface AuditReportSectionProps {
  pdfLoading: boolean;
  setPdfLoading: (v: boolean) => void;
  prepareReportData: (admin: string) => ReturnType<typeof import('@/features/ibd/core/reports/useAuditEvidenceReport').useAuditEvidenceReport>['prepareReportData'] extends (...args: infer A) => infer R ? R : never;
  setLastAction: (msg: string) => void;
}

export function AuditReportSection({ pdfLoading, setPdfLoading, prepareReportData, setLastAction }: AuditReportSectionProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          📄 監査エビデンスレポート
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支援計画シート確定履歴・観察ログ・遵守状況サマリをA4 PDFで出力。
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
                const [{ pdf }, { AuditEvidenceReportPDF }] = await Promise.all([
                  import('@react-pdf/renderer'),
                  import('@/features/ibd/core/reports/AuditEvidenceReportPDF'),
                ]);
                const reportData = prepareReportData('デモ管理者');
                const blob = await pdf(<AuditEvidenceReportPDF data={reportData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `IBD_監査エビデンス_デモ利用者太郎_${toLocalDateISO()}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                setLastAction('✅ 監査エビデンスレポートをダウンロードしました');
              } catch (err) {
                auditLog.error('ibd-demo', 'pdf_generation_failed', {
                  error: err instanceof Error ? err.message : String(err),
                });
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
            A4 × 2ページ（支援計画シート履歴 + 観察ログ）
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Section 9: 介入方法ピッカー ──

interface InterventionSectionProps {
  scenes: SupportScene[];
  selectedIntervention: string;
  onSelect: (method: { label: string; category: string }) => void;
}

export function InterventionSection({ scenes, selectedIntervention, onSelect }: InterventionSectionProps) {
  return (
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
          scenes={scenes}
          onSelect={onSelect}
        />
      </CardContent>
    </Card>
  );
}

// ── Section 10: ABC分析入力 ──

interface ABCEntrySectionProps {
  userId: number;
  selectedIntervention: string;
  onSave: (record: ABCRecord) => void;
}

export function ABCEntrySection({ userId, selectedIntervention, onSave }: ABCEntrySectionProps) {
  return (
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
          userId={String(userId)}
          recordedBy="100"
          interventionUsed={selectedIntervention || undefined}
          onSave={onSave}
        />
      </CardContent>
    </Card>
  );
}

// ── Section 11: ABC集計レポート ──

interface ABCSummarySectionProps {
  userId: number;
  abcRecords: ABCRecord[];
}

export function ABCSummarySection({ userId, abcRecords }: ABCSummarySectionProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          📊 ABC集計レポート
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          蓄積されたABCデータを分析。行動の機能分析とPBSに基づく代替行動の推奨。
        </Typography>

        <ABCSummaryReport records={abcRecords.length > 0 ? abcRecords : getABCRecordsForUser(String(userId))} />
      </CardContent>
    </Card>
  );
}
