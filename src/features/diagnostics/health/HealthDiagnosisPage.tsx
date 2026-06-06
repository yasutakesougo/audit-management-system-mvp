import { readEnv } from "@/lib/env";
import { useSP } from "@/lib/spClient";
import { recordHealthDiagnostics } from "@/sharepoint/healthReportAdapter";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/material";
import React from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { StatusChip, statusColor } from "./components/StatusChip";
import { toAdminSummary } from "./toAdminSummary";
import { HealthContext, HealthReport } from "./types";
import { DriftObservabilityPanel } from "../drift/observability/DriftObservabilityPanel";
import { HealthFilterBar, type HealthFilterState } from "./components/HealthFilterBar";
import { useSpHealthSignal } from "@/features/sp/health/hooks/useSpHealthSignal";
import {
  clearSpHealthSignal,
  type SpHealthReasonCode,
} from "@/features/sp/health/spHealthSignalStore";
import { GovernanceAdvisePanel } from "../remediation/components/GovernanceAdvisePanel";
import { SpIndexPressurePanel } from "@/features/sp/health/indexAdvisor/SpIndexPressurePanel";
import { SpRemediationCard } from "@/features/sp/health/remediation/SpRemediationCard";
import { useNightlySignalIngestion } from "@/features/sp/health/hooks/useNightlySignalIngestion";
import { SelfHealingResultsPanel } from "@/features/sp/health/remediation/SelfHealingResultsPanel";
import { SilentDriftSummaryCard } from "./components/SilentDriftSummaryCard";
import { DiagnosticsSummaryPanel } from "./components/DiagnosticsSummaryPanel";
import { SpTelemetryPanel } from "./components/SpTelemetryPanel";
import { CheckResultsPanel } from "./components/CheckResultsPanel";


// ─── highlight: reasonCode → category ─────────────────────────────────────────
const HIGHLIGHT_CATEGORY: Partial<Record<SpHealthReasonCode, string>> = {
  sp_limit_reached:     'schema',
  sp_index_pressure:    'schema',
  sp_bootstrap_blocked: 'lists',
  sp_auth_failed:       'auth',
  sp_list_unreachable:  'lists',
};

const HIGHLIGHT_STATUS_LABEL: Partial<Record<SpHealthReasonCode, string>> = {
  sp_limit_reached:     '容量上限到達',
  sp_index_pressure:    'インデックス逼迫',
  sp_bootstrap_blocked: 'プロビジョニング停止',
  sp_auth_failed:       '認証エラー',
  sp_list_unreachable:  'リスト到達不能',
};

// ──────────────────────────────────────────────────────────────
// Clipboard helper
// ──────────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallback
  }

  // fallback: textarea
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}


export function HealthDiagnosisPage(props: { 
  ctx: HealthContext,
  report: HealthReport | null,
  loading: boolean,
  error: string | null,
  run: () => Promise<void>
}) {
  const { report, loading, error, run } = props;
  const [activeTab, setActiveTab] = React.useState<string | "all">("all");
  const [filterState, setFilterState] = React.useState<HealthFilterState>({ level: 'all', resource: '' });
  const [searchParams] = useSearchParams();
  const sp = useSP();

  // ── Nightly Signal Ingestion ──────────────────────────────────────────
  useNightlySignalIngestion();

  // ── highlight / filter クエリパラメータ ──────────────────────────────────
  const highlightCode = (searchParams.get('highlight') ?? '') as SpHealthReasonCode | '';
  const highlightCategory = highlightCode ? (HIGHLIGHT_CATEGORY[highlightCode] ?? '') : '';

  // highlight クエリがあれば対応カテゴリへ自動切替（初回のみ）
  React.useEffect(() => {
    if (highlightCategory) {
      setActiveTab(highlightCategory);
    }
  }, [highlightCategory]);

  // ?filter=fail などで level フィルタの初期値を指定できる
  // ?resource=ListName や ?list=ListName でリソース名フィルタの初期値を指定できる
  React.useEffect(() => {
    const levelParam = searchParams.get('filter');
    if (levelParam === 'fail' || levelParam === 'warn' || levelParam === 'pass') {
      setFilterState((p) => ({ ...p, level: levelParam }));
    }

    const resourceParam = searchParams.get('resource') || searchParams.get('list');
    if (resourceParam) {
      setFilterState((p) => ({ ...p, resource: resourceParam }));
    }
  }, [searchParams]);

  // ── Signal バナー ──────────────────────────────────────────────────────────
  const currentSignal = useSpHealthSignal();

  // Save state management
  const [savingState, setSavingState] = React.useState<{
    saving: boolean;
    success: boolean;
    error: string | null;
  }>({
    saving: false,
    success: false,
    error: null,
  });

  // ─────────────────────────────────────────────────────────────
  // Title 生成: "health:<tenant>:<site>"
  // ─────────────────────────────────────────────────────────────
  const generateDiagnosticsTitle = (): string => {
    const tenant = readEnv('VITE_SP_TENANT', 'unknown-tenant');
    const site = readEnv('VITE_SP_SITE', 'unknown-site');
    return `health:${tenant}:${site}`;
  };

  // ─────────────────────────────────────────────────────────────
  // SharePoint に診断結果を記録 - Toast 通知対応
  // ─────────────────────────────────────────────────────────────
  const handleRecordToSharePoint = async () => {
    if (!report) return;

    setSavingState({ saving: true, success: false, error: null });

    try {
      const siteUrl = readEnv('VITE_SP_SITE_URL', '');
      await recordHealthDiagnostics(sp, report, siteUrl);

      // ✅ Success: Show toast and auto-dismiss after 3s
      setSavingState({ saving: false, success: true, error: null });
      setTimeout(() => {
        setSavingState((p) => ({ ...p, success: false }));
      }, 3000);


    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSavingState({ saving: false, success: false, error: msg });
      console.error('[HealthDiagnosisPage] Failed to record to SharePoint:', err);
    }
  };

  const categoryLabels: Record<string, string> = {
    all: "すべて",
    config: "設定",
    auth: "認証",
    connectivity: "通信",
    lists: "リスト",
    schema: "構造整合性",
    permissions: "権限",
  };

  // カテゴリ絞り込み → level + resource 絞り込み
  const filteredResults = React.useMemo(() => {
    if (!report) return [];
    let results = activeTab === "all"
      ? report.results
      : report.results.filter((r) => (r.category as string) === activeTab);

    if (filterState.level !== 'all') {
      results = results.filter((r) => r.status === filterState.level);
    }
    if (filterState.resource.trim()) {
      const q = filterState.resource.trim().toLowerCase();
      results = results.filter(
        (r) => r.label.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q),
      );
    }
    return results;
  }, [report, activeTab, filterState]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* ─────────────────────────────────────────────────────────────
            Signal バナー（現在のシグナルがある場合のみ表示）
            ───────────────────────────────────────────────────────────── */}
        {currentSignal && (
          <Alert
            severity={currentSignal.severity === 'critical' ? 'error' : 'warning'}
            action={
              <Stack direction="row" spacing={1}>
                <Tooltip title="修復作業が完了したことをマークします（問題が解決していない場合、次回のパトロールで再検知されます）">
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ color: 'inherit', borderColor: 'rgba(0,0,0,0.2)' }}
                    onClick={() => {
                      clearSpHealthSignal();
                    }}
                  >
                    対応済みとしてクリア
                  </Button>
                </Tooltip>
                {currentSignal.actionUrl && (
                  <Button
                    size="small"
                    component={currentSignal.actionType === 'internal' ? RouterLink : 'a'}
                    {...(currentSignal.actionType === 'internal'
                      ? { to: currentSignal.actionUrl }
                      : { href: currentSignal.actionUrl, target: '_blank', rel: 'noopener noreferrer' })}
                  >
                    詳細 →
                  </Button>
                )}
              </Stack>
            }
          >
            <strong>
              {HIGHLIGHT_STATUS_LABEL[currentSignal.reasonCode] ?? currentSignal.reasonCode}
              {currentSignal.occurrenceCount >= 2 ? ` ×${currentSignal.occurrenceCount}` : ''}
            </strong>
            {currentSignal.listName ? ` [${currentSignal.listName}]` : ''}
            {' '}
            <Typography component="span" variant="caption" color="inherit">
              ({currentSignal.source === 'realtime' ? 'Realtime' : 'Nightly'} {' '}
              {currentSignal.occurredAt.slice(0, 16).replace('T', ' ')})
            </Typography>
          </Alert>
        )}

        {/* Self-Healing 結果パネル */}
        <SelfHealingResultsPanel />

        {/* Self-Healing 候補パネル / 修復推奨カード */}
        {currentSignal?.remediation && (
          <SpRemediationCard />
        )}

        {currentSignal?.reasonCode === 'sp_index_pressure' && currentSignal.listName && (
          <SpIndexPressurePanel 
            listName={currentSignal.listName} 
            onRefresh={run}
          />
        )}

        {/* highlight バナー（?highlight= クエリがある場合） */}
        {highlightCode && (
          <Alert severity="info" onClose={() => {}}>
            <strong>{HIGHLIGHT_STATUS_LABEL[highlightCode] ?? highlightCode}</strong>
            {' '}に関連する項目を強調表示中
          </Alert>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ヘッダー: タイトル + アクションボタン
            ───────────────────────────────────────────────────────────── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5">環境診断</Typography>
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: "warning.main",
                color: "warning.contrastText",
                fontWeight: 600,
                lineHeight: 1.6,
              }}
            >
              管理者専用
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={run} disabled={loading} data-testid="diagnostics-run">
              {loading ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CircularProgress size={18} />
                  <span>実行中...</span>
                </Stack>
              ) : (
                "再実行"
              )}
            </Button>
            <Button
              variant="contained"
              disabled={!report || savingState.saving}
              onClick={handleRecordToSharePoint}
              size="small"
              data-testid="diagnostics-save"
            >
              {savingState.saving ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CircularProgress size={18} color="inherit" />
                  <span>保存中...</span>
                </Stack>
              ) : (
                "SharePoint に保存"
              )}
            </Button>
            <Button
              variant="outlined"
              disabled={!report}
              size="small"
              onClick={async () => {
                if (!report) return;
                const summary = toAdminSummary(report);
                await copyToClipboard(summary);
                alert("サマリーをコピーしました");
              }}
            >
              サマリーをコピー
            </Button>
            <Button
              variant="outlined"
              disabled={!report}
              size="small"
              onClick={async () => {
                if (!report) return;
                await copyToClipboard(JSON.stringify(report, null, 2));
                alert("JSONをコピーしました");
              }}
            >
              JSONをコピー
            </Button>
          </Stack>
        </Stack>

        {/* トースト通知: 保存成功 / 失敗 */}
        {savingState.success && (
          <Alert severity="success" onClose={() => setSavingState((p) => ({ ...p, success: false }))} data-testid="diagnostics-save-alert">
            ✅ 診断結果を SharePoint に保存しました
          </Alert>
        )}

        {savingState.error && (
          <Alert severity="error" onClose={() => setSavingState((p) => ({ ...p, error: null }))} data-testid="diagnostics-save-alert">
            ❌ 保存に失敗しました: {savingState.error}
          </Alert>
        )}

        {/* ローカル stub モード注記 */}
        {!props.ctx.isProductionLike && (
          <Alert severity="info" data-testid="diagnostics-stub-notice">
            ローカル／stub モードで実行中です。auth・connectivity・lists の FAIL は SharePoint に接続していないため期待どおりです。
            実テナント接続環境（<code>VITE_SP_*</code> 設定済みの dev/stg）で再実行すると、これらの項目が評価されます。
          </Alert>
        )}

        {/* 総合判定パネル */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle1">総合判定</Typography>
            {loading && <CircularProgress size={18} />}
            {report && <StatusChip status={report.overall} />}
            {report && (
              <Typography variant="body2" color="text.secondary">
                PASS {report.counts.pass} / WARN {report.counts.warn} / FAIL{" "}
                {report.counts.fail}
              </Typography>
            )}
          </Stack>
          {error && (
            <Typography sx={{ mt: 1 }} color="error" variant="body2">
              失敗: {error}
            </Typography>
          )}
        </Paper>

        {/* SP通信状態パネル */}
        <SpTelemetryPanel />

        <SilentDriftSummaryCard />
        <DriftObservabilityPanel />

        <GovernanceAdvisePanel />

        {/* 診断結果サマリーパネル */}
        {report && (
          <DiagnosticsSummaryPanel
            report={report}
            diagnosticsTitle={generateDiagnosticsTitle()}
          />
        )}

        {/* カテゴリ別フィルタ (Tabs) */}
        {report && (
           <Paper variant="outlined" sx={{ bgcolor: 'background.paper' }}>
             <Tabs
               value={activeTab}
               onChange={(_, v) => setActiveTab(v)}
               variant="scrollable"
               scrollButtons="auto"
               sx={{ borderBottom: 1, borderColor: 'divider' }}
             >
               <Tab 
                 value="all"
                 label={
                   <Stack direction="row" spacing={1} alignItems="center">
                     <span>すべて</span>
                     <Chip 
                       size="small" 
                       label={report.results.length} 
                       variant="outlined"
                       sx={{ height: 20, fontSize: '0.65rem' }} 
                     />
                   </Stack>
                 } 
               />
               <Tab value="drift" label="Drift" />
               {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
               {(Object.entries(report.byCategory) as [string, any][]).map(([cat, v]) => (
                 <Tab 
                   key={cat} 
                   value={cat}
                   label={
                     <Stack direction="row" spacing={1} alignItems="center">
                       <span>{categoryLabels[cat] || cat}</span>
                       <Chip 
                         size="small" 
                         label={v.counts.fail > 0 ? v.counts.fail : v.counts.warn > 0 ? v.counts.warn : v.counts.pass}
                         color={statusColor(v.overall)}
                         sx={{ height: 20, fontSize: '0.65rem' }}
                       />
                     </Stack>
                   }
                 />
               ))}
             </Tabs>
           </Paper>
        )}

        {/* フィルタバー（level / resource） */}
        {report && activeTab !== "drift" && (
          <HealthFilterBar
            results={report.results}
            filter={filterState}
            onChange={(next) => setFilterState((p) => ({ ...p, ...next }))}
          />
        )}

        {/* 個別チェック結果パネル */}
        {report && (
          <CheckResultsPanel
            report={report}
            activeTab={activeTab}
            filterState={filterState}
            filteredResults={filteredResults}
            highlightCategory={highlightCategory}
            highlightCode={highlightCode}
          />
        )}

        {/* 注記 */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
          <Typography variant="subtitle2">【管理者向け注意事項】</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            • このページは管理者専用です。FAIL は管理者が対処すべき問題を示します
            <br />
            • 権限不足の FAIL は SharePoint 管理者による権限付与が必要です（アプリ側で回避手段は提供しません）
            <br />
            • 大量データの全文検索は保証しません（SharePoint検索/ビュー設計に依存）
            <br />
            • 同時編集の競合は発生しうる（ETag/412 で検知し、案内します）
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
