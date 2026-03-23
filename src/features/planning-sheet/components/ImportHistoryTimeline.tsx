/**
 * ImportHistoryTimeline — 取込セッション履歴一覧コンポーネント
 *
 * importAuditStore に保存された取込記録を時系列で表示する。
 * 「いつ・誰が・何から・どのモードで取り込んだか」を軽い一覧で見せる。
 *
 * 設計方針:
 *  - 詳細監査画面ではなく、軽い時系列一覧
 *  - 必要時に詳細（provenance）を展開可能
 *  - 支援計画シート画面に配置可能なパネルサイズ
 */
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { formatDateTimeIntl } from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportHistoryTimelineProps {
  /** 取込履歴レコード群（importedAt 降順推奨） */
  records: ImportAuditRecord[];
  /** コンパクト表示（最新3件のみ） */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  return formatDateTimeIntl(iso, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }, iso);
}

const MODE_LABELS: Record<string, string> = {
  'assessment-only': 'アセスメントのみ',
  'with-tokusei': 'アセスメント＋特性アンケート',
  'behavior-monitoring': '行動モニタリング反映',
};

const MODE_COLORS: Record<string, 'info' | 'success' | 'warning'> = {
  'assessment-only': 'info',
  'with-tokusei': 'success',
  'behavior-monitoring': 'warning',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportHistoryTimeline: React.FC<ImportHistoryTimelineProps> = ({
  records,
  compact = false,
}) => {
  if (records.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon color="disabled" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            取込履歴はありません
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // 時系列降順（最新が上）
  const sorted = [...records].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
  );
  const displayed = compact ? sorted.slice(0, 3) : sorted;
  const hiddenCount = compact ? Math.max(0, sorted.length - 3) : 0;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* ─── ヘッダー ─── */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <HistoryIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          取込履歴
        </Typography>
        <Chip
          label={`${records.length}件`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      </Box>

      {/* ─── タイムライン ─── */}
      <Box>
        {displayed.map((record, index) => (
          <Accordion
            key={record.id}
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              borderBottom: index < displayed.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              sx={{ minHeight: 40, py: 0, px: 2, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ minWidth: 70 }}>
                  {formatDateTime(record.importedAt)}
                </Typography>
                <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                  {record.importedBy || '—'}
                </Typography>
                <Chip
                  label={MODE_LABELS[record.mode] ?? record.mode}
                  size="small"
                  variant="outlined"
                  color={MODE_COLORS[record.mode] ?? 'info'}
                  sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                />
                <Chip
                  label={`${record.affectedFields.length}項目`}
                  size="small"
                  variant="filled"
                  color="default"
                  sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                />
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
              <Stack spacing={1}>
                {/* サマリー */}
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {record.summaryText}
                </Typography>

                {/* 変更フィールド */}
                {record.affectedFields.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      変更フィールド:
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                      {record.affectedFields.map((field) => (
                        <Chip
                          key={field}
                          label={field}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* provenance 概要 */}
                {record.provenance.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      変換根拠 ({record.provenance.length}件):
                    </Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                      {record.provenance.slice(0, 5).map((p, i) => (
                        <Stack key={i} direction="row" spacing={0.5} alignItems="flex-start">
                          <DescriptionOutlinedIcon sx={{ fontSize: 10, mt: 0.25, color: 'action.active' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.3 }}>
                            <strong>{p.sourceLabel}</strong> → {p.reason}
                          </Typography>
                        </Stack>
                      ))}
                      {record.provenance.length > 5 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', pl: 2 }}>
                          他 {record.provenance.length - 5}件...
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}

        {/* コンパクト時の「さらに表示」 */}
        {hiddenCount > 0 && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              他 {hiddenCount}件の履歴
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};
