/**
 * MeetingEvidenceDraftPanel — モニタリング会議ドラフト自動引用パネル
 *
 * 日次記録・アラート・行動パターン・戦略実績を統合して
 * 会議用テキストドラフトを表示する。
 *
 * ── 機能 ──
 * 1. 4ソースの引用セクションを severity 色付き表示
 * 2. fullText のワンクリックコピー
 * 3. 評価フィールドへの引用ボタン
 * 4. 元データ件数の表示
 * 5. 部分欠損でも崩れない
 * 6. 折りたたみ可能
 *
 * @module features/monitoring/components/MeetingEvidenceDraftPanel
 */
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { UseMeetingEvidenceDraftResult } from '../hooks/useMeetingEvidenceDraft';
import type { MeetingEvidenceSection } from '@/domain/bridge/meetingEvidenceDraft';

// ── Types ───────────────────────────────────────────────

export type MeetingEvidenceDraftPanelProps = {
  /** useMeetingEvidenceDraft の戻り値 */
  evidence: UseMeetingEvidenceDraftResult;
  /** 評価文フィールドへテキストを追記する */
  onAppendToField: (text: string) => void;
  /** admin 権限（false のとき引用ボタン非活性） */
  isAdmin: boolean;
};

// ── Severity 色マッピング ────────────────────────────────

const SEVERITY_CONFIG: Record<
  MeetingEvidenceSection['severity'],
  {
    color: 'warning' | 'info' | 'default';
    icon: React.ReactNode;
    borderColor: string;
    bgColor: string;
  }
> = {
  warning: {
    color: 'warning',
    icon: <WarningAmberRoundedIcon fontSize="small" />,
    borderColor: 'warning.main',
    bgColor: 'warning.50',
  },
  info: {
    color: 'info',
    icon: <InfoOutlinedIcon fontSize="small" />,
    borderColor: 'info.main',
    bgColor: 'info.50',
  },
  neutral: {
    color: 'default',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    borderColor: 'divider',
    bgColor: 'action.hover',
  },
};

// ── セクション表示コンポーネント ─────────────────────────

const SectionCard: React.FC<{
  section: MeetingEvidenceSection;
}> = ({ section }) => {
  const config = SEVERITY_CONFIG[section.severity];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: 3,
        borderColor: config.borderColor,
        bgcolor: config.bgColor,
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          {config.icon}
          <Typography
            variant="subtitle2"
            component="span"
            sx={{ fontWeight: 600 }}
          >
            {section.title.replace('■ ', '')}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={config.color}
            label={section.source}
            sx={{ fontSize: '0.65rem', height: 20 }}
          />
        </Stack>
        <Box
          sx={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.8rem',
            lineHeight: 1.6,
            color: 'text.secondary',
            pl: 3.5,
          }}
        >
          {section.content}
        </Box>
      </Stack>
    </Paper>
  );
};

// ── メインパネル ────────────────────────────────────────

const MeetingEvidenceDraftPanel: React.FC<MeetingEvidenceDraftPanelProps> = ({
  evidence,
  onAppendToField,
  isAdmin,
}) => {
  const { draft, dailyRecordCount, abcRecordCount } = evidence;
  const [copyLabel, setCopyLabel] = React.useState('コピー');

  // ── コピー処理 ──
  const handleCopy = React.useCallback(async () => {
    if (!draft.fullText) return;
    try {
      await navigator.clipboard.writeText(draft.fullText);
      setCopyLabel('コピー済 ✓');
      setTimeout(() => setCopyLabel('コピー'), 2000);
    } catch {
      // clipboard が使えない場合のフォールバック
      setCopyLabel('コピー失敗');
      setTimeout(() => setCopyLabel('コピー'), 2000);
    }
  }, [draft.fullText]);

  // ── 空状態 ──
  if (draft.sourceCount === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AssignmentRoundedIcon fontSize="small" color="disabled" />
          <Typography variant="body2" color="text.secondary">
            会議ドラフトの元データがありません。日々の記録や行動記録を入力すると自動生成されます。
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // ── warning セクションの件数 ──
  const warningCount = draft.sections.filter(
    (s) => s.severity === 'warning',
  ).length;

  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={0}
      sx={{
        border: 1,
        borderColor: warningCount > 0 ? 'warning.light' : 'divider',
        borderRadius: 1,
        '&::before': { display: 'none' },
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: warningCount > 0 ? 'warning.50' : 'action.hover',
          minHeight: 48,
          '& .MuiAccordionSummary-content': { my: 0.5 },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ width: '100%', pr: 1 }}
        >
          <AssignmentRoundedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" component="span" color="primary">
            会議用エビデンスドラフト
          </Typography>
          <Chip
            size="small"
            label={`${draft.sourceCount}ソース`}
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20 }}
          />
          {warningCount > 0 && (
            <Chip
              size="small"
              label={`${warningCount}件の注意`}
              color="warning"
              variant="filled"
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            日次{dailyRecordCount}件 ・ ABC{abcRecordCount}件
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {/* セクション一覧 */}
          {draft.sections.map((section, i) => (
            <SectionCard key={`${section.source}-${i}`} section={section} />
          ))}

          {/* アクションボタン */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={handleCopy}
              data-testid="meeting-draft-copy"
            >
              {copyLabel}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<FormatQuoteRoundedIcon />}
              onClick={() => onAppendToField(draft.fullText)}
              disabled={!isAdmin}
              data-testid="meeting-draft-append"
            >
              評価文へ引用
            </Button>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default React.memo(MeetingEvidenceDraftPanel);
