import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { HealthContext, HealthReport, HealthStatus } from "./types";
import { useHealthChecks } from "./useHealthChecks";

// ──────────────────────────────────────────────────────────────
// ユーティリティ：Teams 共有向けフォーマット（福祉事業所向け・3段テンプレ）
// ──────────────────────────────────────────────────────────────

function toAdminSummary(report: HealthReport): string {
  const categoryOrder: Record<string, number> = {
    auth: 1,
    connectivity: 2,
    lists: 3,
    schema: 4,
    permissions: 5,
    config: 6,
  };

  const counts = report.counts || { pass: 0, warn: 0, fail: 0 };
  const overall = String(report.overall || "unknown").toLowerCase();
  const generatedAt = report.generatedAt || "";

  const issues = (report.results || [])
    .filter((r) => r.status !== "pass")
    .sort(
      (a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99)
    )
    .slice(0, 5)
    .map((r) => {
      const summary = r.summary || "";
      const action = r.nextActions?.[0]?.label || "";
      const body = action && action !== summary ? `${summary} → ${action}` : summary;
      return `- ${r.status.toUpperCase()} [${r.category}] ${body}`;
    });

  const headerLine =
    overall === "pass"
      ? `判定: ✅ PASS | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`
      : overall === "warn"
        ? `判定: 🟡 WARN | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`
        : `判定: 🔴 FAIL | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`;

  if (overall === "pass") {
    return [
      "【Iceberg-PDCA 環境診断】",
      headerLine,
      `生成: ${generatedAt}`,
      "",
      "✅ 環境セットアップ完了",
      "次のステップ：",
      "- 利用者/職員でログイン確認を実施",
      "- 必要に応じて『サマリーをコピー』で管理者に共有",
      "",
      "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (overall === "warn") {
    return [
      "【Iceberg-PDCA 環境診断】",
      headerLine,
      `生成: ${generatedAt}`,
      "",
      "【要対応（上位）】",
      ...(issues.length ? issues : ["- WARN が検出されています"]),
      "",
      "【管理者へ】",
      "- リスト/列/権限を確認し、必要に応じて修正",
      "- リスト作成や列追加が必要な場合は Provision を再実行",
      "- 技術者へ相談する場合は『JSONをコピー』を共有",
      "",
      "【現場へ】",
      "- ログイン後に画面を再読み込みし、再実行で改善確認",
      "",
      "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // FAIL
  return [
    "【Iceberg-PDCA 環境診断】",
    headerLine,
    `生成: ${generatedAt}`,
    "",
    "【要対応（上位）】",
    ...(issues.length ? issues : ["- FAIL が検出されています"]),
    "",
    "【まず管理者がやること】",
    "- SharePoint でリストと必須列の存在を確認",
    "- 権限を付与するか Provision を再実行",
    "- 技術者へ共有：『JSONをコピー』を貼り付け",
    "",
    "【現場へ】",
    "- ログイン後に再実行し、改善状況を確認",
    "",
    "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
  ]
    .filter(Boolean)
    .join("\n");
}

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

const statusColor = (s: HealthStatus): "success" | "warning" | "error" => {
  switch (s) {
    case "pass":
      return "success";
    case "warn":
      return "warning";
    case "fail":
      return "error";
  }
};

function StatusChip({ status }: { status: HealthStatus }) {
  return (
    <Chip
      size="small"
      label={status.toUpperCase()}
      color={statusColor(status)}
    />
  );
}

export function HealthDiagnosisPage(props: { ctx: HealthContext }) {
  const { report, loading, error, run } = useHealthChecks(props.ctx);
  const [openKeys, setOpenKeys] = React.useState<Record<string, boolean>>({});

  const toggle = (k: string) => setOpenKeys((p) => ({ ...p, [k]: !p[k] }));

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h5">環境診断（/diagnostics/health）</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={run} disabled={loading}>
              再実行
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

        {/* 総合判定 */}
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

        {/* カテゴリ別 */}
        {report && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              カテゴリ別
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1 }}
            >
              {Object.entries(report.byCategory).map(([cat, v]) => (
                <Chip
                  key={cat}
                  label={`${cat}: ${v.overall.toUpperCase()} (P${v.counts.pass}/W${v.counts.warn}/F${v.counts.fail})`}
                  color={statusColor(v.overall)}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Paper>
        )}

        {/* 個別チェック */}
        {report && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1">個別チェック</Typography>
            <Divider sx={{ my: 1 }} />

            <Stack spacing={1}>
              {report.results.map((r) => {
                const open = Boolean(openKeys[r.key]);
                return (
                  <Paper key={r.key} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <StatusChip status={r.status} />
                          <Typography
                            variant="subtitle2"
                            noWrap
                            title={r.label}
                            sx={{ flex: 1, minWidth: 0 }}
                          >
                            {r.label}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={r.category}
                          />
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
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {r.detail}
                        </Typography>
                      )}

                      {r.evidence && (
                        <Box sx={{ mt: 1 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            証跡（evidence）
                          </Typography>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              overflow: "auto",
                              maxHeight: "200px",
                            }}
                          >
                            {JSON.stringify(r.evidence, null, 2)}
                          </pre>
                        </Box>
                      )}

                      {r.nextActions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            次にやること
                          </Typography>
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            {r.nextActions.map((a, idx) => (
                              <Paper key={idx} variant="outlined" sx={{ p: 1 }}>
                                <Typography variant="body2">
                                  {a.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ whiteSpace: "pre-wrap" }}
                                >
                                  {a.value}
                                </Typography>
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
          <Typography variant="subtitle2">【ご注意】</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            • 大量データの全文検索は保証しません（SharePoint検索/ビュー設計に依存）
            <br />
            • 同時編集の競合は発生しうる（ETag/412 で検知し、案内します）
            <br />
            • 権限は SharePoint が正（アプリ側で"抜け道"は作りません）
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
