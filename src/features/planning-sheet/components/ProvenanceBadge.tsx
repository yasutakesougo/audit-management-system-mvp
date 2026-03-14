/**
 * ProvenanceBadge — 出典追跡バッジコンポーネント
 *
 * アセスメントから取り込まれた項目に「どこから・なぜ」を表示する。
 * Tooltip でホバー時に詳細を、コンパクトなChipで出典を常時表示。
 */
import type { ProvenanceEntry, ProvenanceSource } from '@/features/planning-sheet/assessmentBridge';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Source color mapping
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<ProvenanceSource, 'primary' | 'secondary' | 'success' | 'info' | 'warning'> = {
  assessment_sensory: 'primary',
  assessment_icf: 'info',
  assessment_tags: 'secondary',
  tokusei_survey: 'success',
  planning_sheet: 'warning',
  monitoring: 'warning',
  monitoring_goal: 'warning',
  monitoring_decision: 'warning',
};

const SOURCE_ICON_LABEL: Record<ProvenanceSource, string> = {
  assessment_sensory: '感覚',
  assessment_icf: 'ICF',
  assessment_tags: 'タグ',
  tokusei_survey: 'アンケ',
  planning_sheet: '計画',
  monitoring: 'モニタ',
  monitoring_goal: '目標評価',
  monitoring_decision: '決定事項',
};

// ---------------------------------------------------------------------------
// ProvenanceChip: 1エントリのコンパクト表示
// ---------------------------------------------------------------------------

export const ProvenanceChip: React.FC<{
  entry: ProvenanceEntry;
}> = ({ entry }) => (
  <Tooltip
    arrow
    title={
      <Stack spacing={0.5} sx={{ maxWidth: 320 }}>
        <Typography variant="caption" fontWeight={600}>
          出典: {entry.sourceLabel}
        </Typography>
        <Typography variant="caption">
          理由: {entry.reason}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          値: {entry.value}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          取込: {new Date(entry.importedAt).toLocaleString('ja-JP')}
        </Typography>
      </Stack>
    }
  >
    <Chip
      size="small"
      variant="outlined"
      color={SOURCE_COLORS[entry.source]}
      label={`${SOURCE_ICON_LABEL[entry.source]}: ${entry.sourceLabel}`}
      icon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />}
      sx={{
        height: 22,
        fontSize: '0.7rem',
        '& .MuiChip-label': { px: 0.5 },
        '& .MuiChip-icon': { ml: 0.5 },
      }}
    />
  </Tooltip>
);

// ---------------------------------------------------------------------------
// ProvenanceBadgeGroup: フィールド単位のバッジ群
// ---------------------------------------------------------------------------

interface ProvenanceBadgeGroupProps {
  /** 対象フィールド名 */
  field: string;
  /** 全 provenance エントリ（フィールドでフィルタリングされる） */
  entries: ProvenanceEntry[];
}

export const ProvenanceBadgeGroup: React.FC<ProvenanceBadgeGroupProps> = ({
  field,
  entries,
}) => {
  const relevant = entries.filter((e) => e.field === field);
  if (relevant.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      {relevant.map((entry, i) => (
        <ProvenanceChip key={`${entry.field}-${entry.source}-${i}`} entry={entry} />
      ))}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// ProvenancePanel: 取込セッション全体のサマリー表示
// ---------------------------------------------------------------------------

interface ProvenancePanelProps {
  /** 全 provenance エントリ */
  entries: ProvenanceEntry[];
  /** パネルの初期表示状態 */
  defaultExpanded?: boolean;
}

/**
 * 取込全体のサマリーパネル。
 * 編集画面のヘッダーや概要エリアに配置し、
 * 何がどこから取り込まれたかを一覧で見せる。
 */
export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  entries,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (entries.length === 0) return null;

  // フィールド別にグルーピング
  const byField = new Map<string, ProvenanceEntry[]>();
  for (const entry of entries) {
    const list = byField.get(entry.field) ?? [];
    list.push(entry);
    byField.set(entry.field, list);
  }

  // 取込セッション数（ユニークな importedAt の日時分まで）
  const uniqueSessions = new Set(
    entries.map((e) => e.importedAt.slice(0, 16)), // YYYY-MM-DDTHH:mm
  );
  const sessionCount = uniqueSessions.size;

  const FIELD_LABELS: Record<string, string> = {
    'observationFacts': '行動観察',
    'collectedInformation': '収集情報',
    'intake.sensoryTriggers': '感覚トリガー',
    'intake.medicalFlags': '医療フラグ',
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: 'action.hover',
        borderColor: 'info.light',
        borderStyle: 'dashed',
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <HistoryRoundedIcon fontSize="small" color="info" />
            <Typography variant="body2" fontWeight={600} color="info.main">
              取込出典 ({entries.length}件 / {sessionCount}回の取込)
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? '出典パネルを閉じる' : '出典パネルを開く'}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* サマリー行（常時表示） */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {[...byField.entries()].map(([field, fieldEntries]) => (
            <Chip
              key={field}
              size="small"
              variant="outlined"
              label={`${FIELD_LABELS[field] ?? field}: ${fieldEntries.length}件`}
              color="info"
            />
          ))}
        </Stack>

        {/* 詳細展開 */}
        <Collapse in={expanded}>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {[...byField.entries()].map(([field, fieldEntries]) => (
              <Box key={field}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  {FIELD_LABELS[field] ?? field}
                </Typography>
                <Divider sx={{ my: 0.5 }} />
                <Stack spacing={0.5}>
                  {fieldEntries.map((entry, i) => (
                    <Stack
                      key={i}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                      sx={{ pl: 1 }}
                    >
                      <Chip
                        size="small"
                        variant="filled"
                        color={SOURCE_COLORS[entry.source]}
                        label={SOURCE_ICON_LABEL[entry.source]}
                        sx={{ height: 20, fontSize: '0.65rem', minWidth: 40 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={500}>
                          {entry.reason}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {entry.value}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
};
