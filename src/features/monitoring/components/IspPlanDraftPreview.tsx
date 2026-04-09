/**
 * @fileoverview ISP 計画書ドラフトプレビュー
 * @description
 * Phase 5-B / 5-D:
 *   buildIspPlanDraft の出力を Accordion 形式で表示する読み取り専用 UI。
 *   6セクションそれぞれを折りたたみ可能に表示し、
 *   全文コピー / 評価文引用 / ISP 計画書への反映 の操作を提供する。
 */
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { IspPlanDraft, IspPlanDraftSectionKind } from '../domain/ispPlanDraftTypes';
import type { SupportPlanStringFieldKey } from '@/features/support-plan-guide/types';
import {
  DRAFT_SECTION_TO_FIELD,
  DRAFT_SECTION_TARGET_LABELS,
  extractApplicableSections,
} from '../domain/ispDraftFieldMapping';

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
  /** Phase 5-C: ドラフト保存コールバック（省略時は保存ボタン非表示） */
  onSaveDraft?: () => void;
  /** Phase 5-C: 保存中フラグ */
  isSavingDraft?: boolean;
  /** Phase 5-C: 保存完了フラグ */
  hasSavedDraft?: boolean;
  /** Phase 5-D: セクションを ISP 計画書へ転記するハンドラ（省略時は反映ボタン非表示） */
  onApplyToEditor?: (fieldKey: SupportPlanStringFieldKey, text: string) => void;
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
  onSaveDraft,
  isSavingDraft = false,
  hasSavedDraft = false,
  onApplyToEditor,
}) => {
  const [justCopied, setJustCopied] = React.useState(false);
  const [justAppended, setJustAppended] = React.useState(false);
  const [justApplied, setJustApplied] = React.useState<string | null>(null);
  const [justAppliedAll, setJustAppliedAll] = React.useState(false);

  // 転記対象セクション
  const applicableSections = React.useMemo(
    () => extractApplicableSections(draft),
    [draft],
  );

  // 一括反映
  const handleApplyAll = React.useCallback(() => {
    if (!onApplyToEditor) return;
    for (const item of applicableSections) {
      onApplyToEditor(item.targetField, item.text);
    }
    setJustAppliedAll(true);
    setTimeout(() => setJustAppliedAll(false), 3000);
  }, [onApplyToEditor, applicableSections]);

  // セクション個別反映
  const handleApplySection = React.useCallback(
    (kind: IspPlanDraftSectionKind) => {
      if (!onApplyToEditor) return;
      const field = DRAFT_SECTION_TO_FIELD[kind];
      if (!field) return;
      const section = draft.sections.find((s) => s.kind === kind);
      if (!section) return;
      onApplyToEditor(field, section.lines.join('\n'));
      setJustApplied(kind);
      setTimeout(() => setJustApplied(null), 3000);
    },
    [onApplyToEditor, draft.sections],
  );

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
            個別支援計画書ドラフト
          </Typography>
          <Chip
            label={`${draft.sections.length}セクション`}
            size="small"
            color="info"
            variant="outlined"
            sx={{ fontSize: '0.65rem' }}
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={0.5}>
          {/* Phase 5-D: ISP 計画書へ一括反映 */}
          {onApplyToEditor && applicableSections.length > 0 && (
            <Tooltip title={`${applicableSections.length}セクションを計画書の各フィールドへ反映します`}>
              <Button
                size="small"
                variant={justAppliedAll ? 'outlined' : 'contained'}
                color={justAppliedAll ? 'success' : 'primary'}
                startIcon={justAppliedAll ? <CheckCircleIcon /> : <SendIcon />}
                onClick={handleApplyAll}
                data-testid="isp-draft-apply-all"
              >
                {justAppliedAll ? '反映しました ✓' : '個別支援計画書へ一括反映'}
              </Button>
            </Tooltip>
          )}
          {/* Phase 5-C: ISP 下書きを保存 */}
          {onSaveDraft && (
            <Button
              size="small"
              variant={hasSavedDraft ? 'outlined' : 'contained'}
              color={hasSavedDraft ? 'success' : 'warning'}
              startIcon={
                isSavingDraft
                  ? <CircularProgress size={14} color="inherit" />
                  : hasSavedDraft
                    ? <CheckCircleIcon />
                    : <SaveIcon />
              }
              onClick={onSaveDraft}
              disabled={isSavingDraft}
              data-testid="isp-draft-save"
            >
              {isSavingDraft ? '保存中…' : hasSavedDraft ? '保存済み ✓' : '個別支援計画下書きを保存'}
            </Button>
          )}
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
            {/* Phase 5-D: セクション個別反映ボタン */}
            {onApplyToEditor && DRAFT_SECTION_TO_FIELD[section.kind] && (
              <Box sx={{ mt: 1, textAlign: 'right' }}>
                <Tooltip
                  title={`「${DRAFT_SECTION_TARGET_LABELS[section.kind]}」フィールドへ反映`}
                >
                  <Button
                    size="small"
                    variant={justApplied === section.kind ? 'outlined' : 'text'}
                    color={justApplied === section.kind ? 'success' : 'primary'}
                    startIcon={justApplied === section.kind ? <CheckCircleIcon /> : <SendIcon />}
                    onClick={() => handleApplySection(section.kind)}
                    data-testid={`isp-draft-apply-${section.kind}`}
                  >
                    {justApplied === section.kind
                      ? '反映済み ✓'
                      : `計画書へ反映 → ${DRAFT_SECTION_TARGET_LABELS[section.kind]}`}
                  </Button>
                </Tooltip>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default React.memo(IspPlanDraftPreview);
