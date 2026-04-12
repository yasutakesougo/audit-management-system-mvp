import { readEnv } from "@/lib/env";
import { useSP } from "@/lib/spClient";
import { recordHealthDiagnostics } from "@/sharepoint/healthReportAdapter";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Divider,
    Paper,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LaunchIcon from "@mui/icons-material/Launch";
import DescriptionIcon from "@mui/icons-material/Description";
import React from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { StatusChip, statusColor } from "./components/StatusChip";
import { toAdminSummary } from "./toAdminSummary";
import { HealthContext } from "./types";
import { useHealthChecks } from "./useHealthChecks";
import { spTelemetryStore } from "@/lib/telemetry/spTelemetryStore";
import { DriftObservabilityPanel } from "../drift/observability/DriftObservabilityPanel";
import { HealthFilterBar, type HealthFilterState } from "./components/HealthFilterBar";
import { useSpHealthSignal } from "@/features/sp/health/hooks/useSpHealthSignal";
import type { SpHealthReasonCode } from "@/features/sp/health/spHealthSignalStore";
import { GovernanceAdvisePanel } from "../remediation/components/GovernanceAdvisePanel";
import { SpIndexPressurePanel } from "@/features/sp/health/indexAdvisor/SpIndexPressurePanel";
import { GovernanceBadge } from "./components/GovernanceBadge";
import { SpRemediationCard } from "@/features/sp/health/remediation/SpRemediationCard";

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


export function HealthDiagnosisPage(props: { ctx: HealthContext }) {
  const { report, loading, error, run } = useHealthChecks(props.ctx);
  const [openKeys, setOpenKeys] = React.useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = React.useState<string | "all">("all");
  const [filterState, setFilterState] = React.useState<HealthFilterState>({ level: 'all', resource: '' });
  const [searchParams] = useSearchParams();
  const sp = useSP();

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

  const toggle = (k: string) => setOpenKeys((p) => ({ ...p, [k]: !p[k] }));

  // SharePoint通信テレメトリ Snapshot ポーリング
  const [spSnapshot, setSpSnapshot] = React.useState(() => spTelemetryStore.getSnapshot());
  React.useEffect(() => {
    const timer = setInterval(() => {
      setSpSnapshot(spTelemetryStore.getSnapshot());
    }, 2000);
    return () => clearInterval(timer);
  }, []);

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

  // highlight: このカテゴリ + fail/warn のアイテムを強調
  const isHighlighted = React.useCallback(
    (r: { category: string; status: string }) =>
      Boolean(highlightCategory) &&
      r.category === highlightCategory &&
      r.status !== 'pass',
    [highlightCategory],
  );

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
                      import('@/features/sp/health/spHealthSignalStore').then(m => m.clearSpHealthSignal());
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
              ({currentSignal.source === 'realtime' ? 'Realtime' : 'Nightly'} /{' '}
              {currentSignal.occurredAt.slice(0, 16).replace('T', ' ')})
            </Typography>
          </Alert>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Self-Healing 候補パネル / 修復推奨カード
            ───────────────────────────────────────────────────────────── */}
        {currentSignal?.remediation && (
          <SpRemediationCard />
        )}

        {currentSignal?.reasonCode === 'sp_index_pressure' && currentSignal.listName && (
          <SpIndexPressurePanel 
            listName={currentSignal.listName} 
            onRefresh={run}
          />
        )}

        {/* ─────────────────────────────────────────────────────────────
            highlight バナー（?highlight= クエリがある場合）
            ───────────────────────────────────────────────────────────── */}
        {highlightCode && (
          <Alert severity="info" onClose={() => {}}>
            <strong>{HIGHLIGHT_STATUS_LABEL[highlightCode] ?? highlightCode}</strong>
            {' '}に関連する項目を強調表示中
          </Alert>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ヘッダー: タイトル + アクションボタン
            ───────────────────────────────────────────────────────────── */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
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

        {/* ─────────────────────────────────────────────────────────────
            トースト通知: 保存成功 / 失敗
            ───────────────────────────────────────────────────────────── */}
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

        {/* ─────────────────────────────────────────────────────────────
            ローカル stub モード注記
            ───────────────────────────────────────────────────────────── */}
        {!props.ctx.isProductionLike && (
          <Alert severity="info" data-testid="diagnostics-stub-notice">
            ローカル／stub モードで実行中です。auth・connectivity・lists の FAIL は SharePoint に接続していないため期待どおりです。
            実テナント接続環境（<code>VITE_SP_*</code> 設定済みの dev/stg）で再実行すると、これらの項目が評価されます。
          </Alert>
        )}

        {/* ─────────────────────────────────────────────────────────────
            総合判定パネル（実行中/エラー情報）
            ───────────────────────────────────────────────────────────── */}
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

        {/* ─────────────────────────────────────────────────────────────
            SP通信状態パネル
            ───────────────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">🌐 SP通信状態</Typography>
            <StatusChip
              status={
                spSnapshot.summary.failedCount > 5
                  ? "fail"
                  : spSnapshot.summary.throttledCount > 20
                  ? "warn"
                  : "pass"
              }
            />
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {`Throttled: ${spSnapshot.summary.throttledCount} / Retry: ${spSnapshot.summary.retryCount} / Failed: ${spSnapshot.summary.failedCount}`}
            <br/>{`Avg Duration: ${spSnapshot.summary.avgDurationMs}ms / P95: ${spSnapshot.summary.p95DurationMs}ms`}
            <br/>{`Avg Queue: ${spSnapshot.summary.avgQueuedMs}ms / Max Queue: ${spSnapshot.summary.maxQueuedMs}ms`}
          </Typography>
          {spSnapshot.topEndpoints.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Top Failing Endpoints:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, typography: "body2" }}>
                {spSnapshot.topEndpoints.map((ep: { endpoint: string; failures: number; retries: number }, i: number) => (
                  <li key={i}>
                    <code>{ep.endpoint}</code> (Fail: {ep.failures}, Retry: {ep.retries})
                  </li>
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        <DriftObservabilityPanel />
        <GovernanceAdvisePanel />

        {/* ─────────────────────────────────────────────────────────────
            診断結果表示パネル
            - overall, topIssue(1行), summaryText(複数行)
            - reportLink（あれば表示）
            ───────────────────────────────────────────────────────────── */}
        {report && report.overall !== "pass" && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover", border: "2px solid" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
              📋 診断結果サマリー
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1.5}>
              {/* Overall */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: "100px" }}>
                  総合判定:
                </Typography>
                <StatusChip status={report.overall} />
              </Stack>

              {/* Title (安定キー) */}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: "100px" }}>
                  Title:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    p: 1,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    flex: 1,
                    wordBreak: "break-all",
                  }}
                >
                  {generateDiagnosticsTitle()}
                </Typography>
              </Stack>

              {/* TopIssue (1行) */}
              {report.results.find((r) => r.status !== "pass") && (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: "100px" }}>
                    最上位課題:
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {report.results.find((r) => r.status === "fail")?.label ||
                      report.results.find((r) => r.status === "warn")?.label ||
                      "特定されませんでした"}
                  </Typography>
                </Stack>
              )}

              {/* SummaryText (複数行) */}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: "100px" }}>
                  詳細:
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    flex: 1,
                    maxHeight: "150px",
                    overflow: "auto",
                  }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(report.byCategory).map(([name, cat]) => (
                      <Chip
                        key={name}
                        size="small"
                        label={`${categoryLabels[name] || name}: ${cat.counts.fail}/${cat.counts.warn}/${cat.counts.pass}`}
                        color={statusColor(cat.overall)}
                        variant={cat.overall === "pass" ? "outlined" : "filled"}
                        sx={{ fontSize: '0.75rem', height: 24 }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              💾 ボタン「SharePoint に保存」でこの情報を記録します
            </Typography>
          </Paper>
        )}

        {/* ─────────────────────────────────────────────────────────────
            カテゴリ別フィルタ (Tabs)
            ───────────────────────────────────────────────────────────── */}
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

        {/* ─────────────────────────────────────────────────────────────
            フィルタバー（level / resource）
            ───────────────────────────────────────────────────────────── */}
        {report && activeTab !== "drift" && (
          <HealthFilterBar
            results={report.results}
            filter={filterState}
            onChange={(next) => setFilterState((p) => ({ ...p, ...next }))}
          />
        )}

        {/* ─────────────────────────────────────────────────────────────
            個別チェック
            ───────────────────────────────────────────────────────────── */}
        {report && activeTab !== "drift" && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              個別チェック ({categoryLabels[activeTab] || activeTab})
            </Typography>
            <Divider sx={{ my: 1 }} />

            <Stack spacing={1}>
              {filteredResults.map((r) => {
                const open = Boolean(openKeys[r.key]);
                const highlighted = isHighlighted(r);
                return (
                  <Paper
                    key={r.key}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      ...(highlighted
                        ? { border: '2px solid', borderColor: 'warning.main', bgcolor: 'warning.50' }
                        : {}),
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <StatusChip status={r.status} />
                          <Typography variant="subtitle2" noWrap title={r.label} sx={{ flex: 1, minWidth: 0 }}>
                            {r.label}
                          </Typography>
                          {r.governance && <GovernanceBadge decision={r.governance} />}
                          <Chip size="small" variant="outlined" label={r.category} sx={{ height: 20, fontSize: '0.65rem' }} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {r.summary}
                        </Typography>
                      </Stack>

                      <Button
                        size="small"
                        onClick={() => toggle(r.key)}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {open ? "閉じる" : "詳細"}
                      </Button>
                    </Stack>

                    <Collapse in={open} unmountOnExit>
                      <Divider sx={{ my: 1 }} />
                      {r.detail && (
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {r.detail}
                        </Typography>
                      )}

                      {r.evidence && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            証跡（evidence）
                          </Typography>
                          
                          {/* 構造整合性（ドリフト）情報の特別表示 */}
                          {r.category === "schema" && Array.isArray((r.evidence as Record<string, unknown>).drifted) ? (
                            <Box sx={{ mt: 0.5, p: 1, bgcolor: "background.paper", borderRadius: 1, border: "1px dashed", borderColor: "warning.main" }}>
                              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: "warning.main" }}>
                                ⚠️ 内部名マッピングの自動調整（整合性）を検出しました
                              </Typography>
                              <Stack spacing={0.5}>
                                {((r.evidence as Record<string, unknown>).drifted as Record<string, string>[]).map((d: Record<string, string>, i: number) => (
                                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                                    <Chip size="small" label={d.expected} variant="outlined" />
                                    <Typography variant="caption">→</Typography>
                                    <Chip size="small" label={d.actual} color="warning" variant="filled" />
                                    {d.driftType && (
                                      <Chip size="small" label={d.driftType} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                    )}
                                  </Stack>
                                ))}
                              </Stack>
                            </Box>
                          ) : (
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "200px", padding: "8px", backgroundColor: "rgba(0,0,0,0.04)", borderRadius: "4px" }}>
                              {JSON.stringify(r.evidence, null, 2)}
                            </pre>
                          )}
                        </Box>
                      )}

                      {r.nextActions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            次にやること
                          </Typography>
                          <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                            {r.nextActions.map((a, idx) => (
                              <Paper key={idx} variant="outlined" sx={{ p: 1.25, bgcolor: "action.selected" }}>
                                <Stack direction="row" spacing={1.25} alignItems="center">
                                  <Box sx={{ color: "primary.main", flexShrink: 0 }}>
                                    {a.kind === "copy" ? <ContentCopyIcon sx={{ fontSize: 18 }} /> :
                                     a.kind === "link" ? <LaunchIcon sx={{ fontSize: 18 }} /> :
                                     <DescriptionIcon sx={{ fontSize: 18 }} />}
                                  </Box>
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{a.label}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, whiteSpace: "pre-wrap", fontFamily: a.kind === "copy" ? "monospace" : "inherit" }}>
                                      {a.value}
                                    </Typography>
                                  </Box>
                                  {a.kind === "copy" && (
                                    <Button size="small" onClick={() => { copyToClipboard(a.value); alert("コピーしました"); }} sx={{ fontSize: '0.65rem', py: 0 }}>
                                      コピー
                                    </Button>
                                  )}
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
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
