import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { statusColor, StatusChip } from "./StatusChip";
import { HealthReport } from "../types";

const categoryLabels: Record<string, string> = {
  all: "すべて",
  config: "設定",
  auth: "認証",
  connectivity: "通信",
  lists: "リスト",
  schema: "構造整合性",
  permissions: "権限",
};

interface DiagnosticsSummaryPanelProps {
  report: HealthReport;
  diagnosticsTitle: string;
}

/**
 * 📋 診断結果サマリーパネル
 *
 * overall が pass でない場合のみ表示する。
 * overall / title / topIssue / カテゴリ別 chip を表示する。
 */
export function DiagnosticsSummaryPanel({
  report,
  diagnosticsTitle,
}: DiagnosticsSummaryPanelProps) {
  if (report.overall === "pass") return null;

  return (
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
            {diagnosticsTitle}
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
                  sx={{ fontSize: "0.75rem", height: 24 }}
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
  );
}
