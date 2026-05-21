import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LaunchIcon from "@mui/icons-material/Launch";
import DescriptionIcon from "@mui/icons-material/Description";
import React from "react";
import { StatusChip } from "./StatusChip";
import { GovernanceBadge } from "./GovernanceBadge";
import type { HealthReport } from "../types";
import type { HealthFilterState } from "./HealthFilterBar";
import type { SpHealthReasonCode } from "@/features/sp/health/spHealthSignalStore";

const categoryLabels: Record<string, string> = {
  all: "すべて",
  config: "設定",
  auth: "認証",
  connectivity: "通信",
  lists: "リスト",
  schema: "構造整合性",
  permissions: "権限",
};

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallback
  }
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

interface CheckResultsPanelProps {
  report: HealthReport;
  activeTab: string | "all";
  filterState: HealthFilterState;
  filteredResults: HealthReport["results"];
  highlightCategory: string;
  highlightCode: SpHealthReasonCode | "";
}

/**
 * 🔍 個別チェック結果パネル
 *
 * カテゴリ別フィルタ + level / resource フィルタを適用した診断結果を
 * アコーディオン形式で表示する。drift タブ選択時は表示しない。
 */
export function CheckResultsPanel({
  activeTab,
  filteredResults,
  highlightCategory,
}: CheckResultsPanelProps) {
  const [openKeys, setOpenKeys] = React.useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpenKeys((p) => ({ ...p, [k]: !p[k] }));

  const isHighlighted = React.useCallback(
    (r: { category: string; status: string }) =>
      Boolean(highlightCategory) &&
      r.category === highlightCategory &&
      r.status !== "pass",
    [highlightCategory],
  );

  if (activeTab === "drift") return null;

  return (
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
                  ? { border: "2px solid", borderColor: "warning.main", bgcolor: "warning.50" }
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
                    <Chip
                      size="small"
                      variant="outlined"
                      label={r.category}
                      sx={{ height: 20, fontSize: "0.65rem" }}
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
                    {r.category === "schema" &&
                    Array.isArray((r.evidence as Record<string, unknown>).drifted) ? (
                      <Box
                        sx={{
                          mt: 0.5,
                          p: 1,
                          bgcolor: "background.paper",
                          borderRadius: 1,
                          border: "1px dashed",
                          borderColor: "warning.main",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ mb: 1, fontWeight: 600, color: "warning.main" }}
                        >
                          ⚠️ 内部名マッピングの自動調整（整合性）を検出しました
                        </Typography>
                        <Stack spacing={0.5}>
                          {(
                            (r.evidence as Record<string, unknown>).drifted as Record<
                              string,
                              string
                            >[]
                          ).map((d: Record<string, string>, i: number) => (
                            <Stack key={i} direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={d.expected} variant="outlined" />
                              <Typography variant="caption">→</Typography>
                              <Chip size="small" label={d.actual} color="warning" variant="filled" />
                              {d.driftType && (
                                <Chip
                                  size="small"
                                  label={d.driftType}
                                  variant="outlined"
                                  sx={{ fontSize: "0.65rem", height: 20 }}
                                />
                              )}
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    ) : (
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                          maxHeight: "200px",
                          padding: "8px",
                          backgroundColor: "rgba(0,0,0,0.04)",
                          borderRadius: "4px",
                        }}
                      >
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
                              {a.kind === "copy" ? (
                                <ContentCopyIcon sx={{ fontSize: 18 }} />
                              ) : a.kind === "link" ? (
                                <LaunchIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <DescriptionIcon sx={{ fontSize: 18 }} />
                              )}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {a.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: "block",
                                  mt: 0.25,
                                  whiteSpace: "pre-wrap",
                                  fontFamily: a.kind === "copy" ? "monospace" : "inherit",
                                }}
                              >
                                {a.value}
                              </Typography>
                            </Box>
                            {a.kind === "copy" && (
                              <Button
                                size="small"
                                onClick={() => {
                                  copyToClipboard(a.value);
                                  alert("コピーしました");
                                }}
                                sx={{ fontSize: "0.65rem", py: 0 }}
                              >
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
  );
}
