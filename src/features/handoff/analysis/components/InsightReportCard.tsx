/**
 * InsightReportCard — AI要約表示カード
 *
 * 3つの状態を持つ:
 * 1. 未生成 — 「AI分析を生成」ボタン
 * 2. 生成中 — ローディング
 * 3. 生成済 — AI生成 or フォールバック（バッジで区別）
 */

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { InsightReportResult } from '../ai/aiTypes';

// ── Props ──

export interface InsightReportCardProps {
  /** 生成済みレポート（null = 未生成） */
  report: InsightReportResult | null;
  /** 生成中フラグ */
  loading?: boolean;
  /** 「AI分析を生成」ボタンのコールバック */
  onGenerate?: () => void;
  /** エラーメッセージ */
  error?: string | null;
}

export default function InsightReportCard({
  report,
  loading = false,
  onGenerate,
  error,
}: InsightReportCardProps) {
  // ── 未生成状態 ──
  if (!report && !loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <SmartToyIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              AI がデータを分析し、朝会・夕会向けの
              <br />
              簡潔なサマリーを自動生成します
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={onGenerate}
              disabled={!onGenerate}
            >
              AI分析を生成
            </Button>
            {error && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <ErrorOutlineIcon color="error" sx={{ fontSize: 16 }} />
                <Typography variant="caption" color="error">
                  {error}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // ── 生成中 ──
  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              AI分析を生成中…
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // ── 生成済み ──
  if (!report) return null;

  const isAi = report.meta.isAiGenerated;
  const generatedTime = new Date(report.meta.generatedAt).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card
      sx={{
        height: '100%',
        borderLeft: 4,
        borderColor: isAi ? 'primary.main' : 'warning.main',
      }}
    >
      <CardContent>
        {/* ── ヘッダー ── */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <SmartToyIcon color={isAi ? 'primary' : 'warning'} sx={{ fontSize: 22 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              AI分析サマリー
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            {isAi ? (
              <Chip
                icon={<CheckCircleOutlineIcon />}
                label={`AI生成 (${report.meta.model})`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, height: 24 }}
              />
            ) : (
              <Chip
                icon={<WarningAmberIcon />}
                label="数値ベース要約"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 600, height: 24 }}
              />
            )}
          </Stack>
        </Stack>

        {/* ── サマリー本文 ── */}
        <Typography
          variant="body2"
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: isAi ? 'primary.50' : 'warning.50',
            borderRadius: 1,
            lineHeight: 1.8,
          }}
        >
          {report.summary}
        </Typography>

        {/* ── 確認事項 ── */}
        {report.keyPoints.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'info.main' }} />
              <Typography variant="caption" fontWeight={700} color="info.main">
                確認事項
              </Typography>
            </Stack>
            <List dense disablePadding>
              {report.keyPoints.map((point, i) => (
                <ListItem key={i} sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Typography variant="caption" color="text.secondary">
                      {i + 1}.
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2">{point}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* ── 推奨アクション ── */}
        {report.suggestedActions.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <LightbulbOutlinedIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="caption" fontWeight={700} color="success.main">
                推奨アクション
              </Typography>
            </Stack>
            <List dense disablePadding>
              {report.suggestedActions.map((action, i) => (
                <ListItem key={i} sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Typography variant="caption" color="text.secondary">
                      →
                    </Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2">{action}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* ── 利用者ハイライト ── */}
        {report.userHighlights.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Divider sx={{ mb: 1 }} />
            {report.userHighlights.map((h, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={1}
                sx={{ mb: 0.5, pl: 0.5 }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 80 }}>
                  {h.userDisplayName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {h.note}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}

        {/* ── フッター ── */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mt: 1 }}
        >
          <Typography variant="caption" color="text.disabled">
            {isAi ? '⚡' : '⚠️'} {generatedTime} 生成
          </Typography>

          {onGenerate && (
            <Button
              size="small"
              startIcon={<AutoAwesomeIcon />}
              onClick={onGenerate}
              disabled={loading}
              sx={{ fontSize: 12 }}
            >
              再生成
            </Button>
          )}
        </Stack>

        {/* ── フォールバック理由 ── */}
        {!isAi && 'reason' in report.meta && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            ※ {report.meta.reason}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
