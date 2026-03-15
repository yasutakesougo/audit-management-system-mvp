/**
 * @fileoverview ISP 計画書ドラフトプレビュー
 * @description
 * Phase 5-B:
 *   buildIspPlanDraft の出力を Accordion 形式で表示する読み取り専用 UI。
 *   6セクションそれぞれを折りたたみ可能に表示し、
 *   全文コピー / 評価文引用 の操作を提供する。
 */
import ArticleIcon from '@mui/icons-material/Article';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { IspPlanDraft, IspPlanDraftSectionKind } from '../domain/ispPlanDraftTypes';

// ─── セクション種別→アイコン表示 ─────────────────────────

const SECTION_ICONS: Record<IspPlanDraftSectionKind, string> = {
  'overview': '📋',
  'monitoring-findings': '📊',
  'goal-assessment': '🎯',
  'decision-summary': '✅',
  'plan-revision': '📝',
  'next-actions': '🚀',
};

// ─── Props ───────────────────────────────────────────────

export interface IspPlanDraftPreviewProps {
  /** ドラフトデータ */
  draft: IspPlanDraft;
  /** 全文コピーボタンの押下ハンドラ */
  onCopyAll?: (text: string) => void;
  /** 評価文引用ハンドラ（省略時は引用ボタン非表示） */
  onAppendToEvaluation?: (text: string) => void;
}

// ─── ドラフト→プレーンテキスト変換 ───────────────────────

function draftToPlainText(draft: IspPlanDraft): string {
  return draft.sections
    .map((s) => `【${s.title}】\n${s.lines.join('\n')}`)
    .join('\n\n');
}

// ─── コンポーネント ──────────────────────────────────────

const IspPlanDraftPreview: React.FC<IspPlanDraftPreviewProps> = ({
  draft,
  onCopyAll,
  onAppendToEvaluation,
}) => {
  const [justCopied, setJustCopied] = React.useState(false);
  const [justAppended, setJustAppended] = React.useState(false);

  const plainText = React.useMemo(() => draftToPlainText(draft), [draft]);

  const handleCopy = React.useCallback(() => {
    if (onCopyAll) {
      onCopyAll(plainText);
    } else {
      navigator.clipboard.writeText(plainText).catch(() => {/* noop */});
    }
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 3000);
  }, [onCopyAll, plainText]);

  const handleAppend = React.useCallback(() => {
    if (!onAppendToEvaluation) return;
    onAppendToEvaluation(plainText);
    setJustAppended(true);
    setTimeout(() => setJustAppended(false), 3000);
  }, [onAppendToEvaluation, plainText]);

  if (draft.sections.length === 0) return null;

  return (
    <Box>
      {/* ヘッダー */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        rowGap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ArticleIcon fontSize="small" sx={{ color: 'info.main' }} />
          <Typography variant="subtitle2" color="info.main" sx={{ fontWeight: 600 }}>
            ISP 計画書ドラフト
          </Typography>
          <Chip
            label={`${draft.sections.length}セクション`}
            size="small"
            color="info"
            variant="outlined"
            sx={{ fontSize: '0.65rem' }}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          {onAppendToEvaluation && (
            <Button
              size="small"
              variant={justAppended ? 'outlined' : 'contained'}
              color={justAppended ? 'success' : 'info'}
              startIcon={<ContentCopyRoundedIcon />}
              onClick={handleAppend}
              data-testid="isp-draft-append"
            >
              {justAppended ? '引用しました ✓' : '評価文へ引用'}
            </Button>
          )}
          <Button
            size="small"
            variant={justCopied ? 'outlined' : 'outlined'}
            color={justCopied ? 'success' : 'inherit'}
            startIcon={<ContentCopyRoundedIcon />}
            onClick={handleCopy}
            data-testid="isp-draft-copy"
          >
            {justCopied ? 'コピーしました ✓' : '全文コピー'}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Phase 1〜4 の分析・判断結果から自動生成された計画書下書きです。内容を確認・編集のうえご活用ください。
      </Typography>

      {/* セクション Accordion */}
      {draft.sections.map((section) => (
        <Accordion
          key={section.kind}
          defaultExpanded={section.kind === 'plan-revision' || section.kind === 'next-actions'}
          disableGutters
          variant="outlined"
          sx={{
            '&:before': { display: 'none' },
            bgcolor: 'background.paper',
            '&:not(:last-child)': { borderBottom: 0 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" component="span">
                {SECTION_ICONS[section.kind]}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {section.title}
              </Typography>
              <Chip
                label={`${section.lines.length}行`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 18 }}
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box
              sx={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.8rem',
                lineHeight: 1.7,
                color: 'text.primary',
                pl: 1,
                borderLeft: '3px solid',
                borderColor: 'info.light',
              }}
            >
              {section.lines.join('\n')}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default React.memo(IspPlanDraftPreview);
