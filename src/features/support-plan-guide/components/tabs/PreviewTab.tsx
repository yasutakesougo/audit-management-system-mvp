/**
 * PreviewTab — Markdownプレビュータブ
 *
 * SectionKey: 'preview'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 *
 * Markdownのレンダリング/ソース切替、コピー、ダウンロード、PDF印刷を提供。
 */
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { startFeatureSpan } from '@/hydration/features';
import type { SupportPlanForm } from '../../types';
import type { ApprovalState } from '../../hooks/useComplianceForm';
import { openPrintView } from '../../utils/pdfExport';
import type { PrintApprovalInfo } from '../../utils/pdfExport';

const MarkdownPreview = React.lazy(() => import('@/pages/SupportPlanGuidePage.Markdown'));

export type PreviewTabProps = {
  /** 現在のフォームデータ */
  form: SupportPlanForm;
  /** 生成済みMarkdown文字列 */
  markdown: string;
  /** レンダー/ソース切替 */
  previewMode: 'render' | 'source';
  /** レンダー/ソース切替ハンドラ */
  onPreviewModeChange: (mode: 'render' | 'source') => void;
  /** アクティブドラフト (nullの場合ボタン無効) */
  activeDraftName: string | undefined;
  /** 管理者かどうか */
  isAdmin: boolean;
  /** Markdownコピー */
  onCopyMarkdown: () => void;
  /** Markdownダウンロード */
  onDownloadMarkdown: () => void;
  /** 非管理者ガード */
  guardAdmin: <T>(fn: (...args: unknown[]) => T) => (...args: unknown[]) => T | undefined;
  /** Markdown feature span (for hydration telemetry) */
  markdownSpan?: ReturnType<typeof startFeatureSpan> | null;
  /** 承認状態（印刷に反映） */
  approvalState?: ApprovalState;
};

const PreviewTab: React.FC<PreviewTabProps> = ({
  form,
  markdown,
  previewMode,
  onPreviewModeChange,
  activeDraftName,
  isAdmin,
  onCopyMarkdown,
  onDownloadMarkdown,
  guardAdmin,
  markdownSpan,
  approvalState,
}) => {
  // 承認情報を印刷用に変換
  const printApproval: PrintApprovalInfo | null = React.useMemo(() => {
    if (!approvalState) return null;
    return {
      approvedBy: approvalState.approvedBy ?? '',
      approvedAt: approvalState.approvedAt ?? '',
      approvalStatus: approvalState.approvalStatus,
    };
  }, [approvalState]);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" component="h3">
              Markdownプレビュー
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={previewMode}
              exclusive
              onChange={(_event, next) => next && onPreviewModeChange(next)}
              aria-label="プレビュー表示切り替え"
            >
              <ToggleButton value="render" aria-label="レンダリング表示">
                レンダリング
              </ToggleButton>
              <ToggleButton value="source" aria-label="ソース表示">
                ソース
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={guardAdmin(onDownloadMarkdown)}
              disabled={!activeDraftName || !isAdmin}
            >
              Markdown保存
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={onCopyMarkdown}
              disabled={!activeDraftName}
            >
              Markdownコピー
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<ArticleRoundedIcon />}
              onClick={() => openPrintView(form, form.serviceUserName || activeDraftName || 'support-plan', printApproval)}
            >
              PDFプレビュー/印刷
            </Button>
          </Stack>
        </Stack>
        <Divider />
        {previewMode === 'render' ? (
          <Box
            sx={{
              '& h2': { fontSize: 18, mt: 2 },
              '& p': { whiteSpace: 'pre-wrap' },
              '& ul': { pl: 4 },
            }}
          >
            <React.Suspense fallback={<LinearProgress sx={{ mt: 1 }} />}>
              <MarkdownPreview content={markdown} spanComplete={markdownSpan ?? undefined} />
            </React.Suspense>
          </Box>
        ) : (
          <Box
            component="pre"
            sx={{
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              m: 0,
            }}
          >
            {markdown}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default React.memo(PreviewTab);
