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

import { useIspRepositories } from '../../hooks/useIspRepositories';
import { useSupportPlanTimeline } from '../../hooks/useSupportPlanTimeline';
import { TimelineSummaryCard } from '../TimelineSummaryCard';
import { SupportPlanActionCard } from '../SupportPlanActionCard';
import { useActionTaskStore } from '@/features/action-engine';
import type { ActionSuggestion } from '@/features/action-engine';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
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

import { buildIbdSheetMarkdown } from '../../utils/markdownExport';
import type { ExportValidationResult } from '../../types/export';
import { ExportValidationCard } from './ExportValidationCard';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

export type PreviewTabProps = {
  /** 現在のフォームデータ */
  form: SupportPlanForm;
  /** 生成済みMarkdown文字列 (ISP) */
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
  onCopyMarkdown: (content?: string) => void;
  /** Markdownダウンロード */
  onDownloadMarkdown: (content?: string, filename?: string) => void;
  /** 非管理者ガード */
  guardAdmin: <T>(fn: (...args: unknown[]) => T) => (...args: unknown[]) => T | undefined;
  /** Markdown feature span (for hydration telemetry) */
  markdownSpan?: ReturnType<typeof startFeatureSpan> | null;
  /** 承認状態（印刷に反映） */
  approvalState?: ApprovalState;
  /** グループごとのロック・ステータス (isVisible等) */
  groupStatus: Record<string, { isVisible: boolean }>;
  /** エクスポート検証結果 */
  exportValidation: ExportValidationResult;
  /** 利用者ID (タイムライン解析用) */
  userId?: number | null;
  /** 背景分析（Iceberg）データ */
  icebergItems?: IcebergPdcaItem[];
  /** 根拠データへのジャンプ */
  onJumpToEvidence?: (sourceType: string, value: unknown) => void;
  /** 推奨アクションへのアクションハンドラ */
  onActionClick?: (action: ActionSuggestion) => void;
};

const PreviewTab: React.FC<PreviewTabProps> = ({
  form,
  markdown: ispMarkdown,
  previewMode,
  onPreviewModeChange,
  activeDraftName,
  isAdmin,
  onCopyMarkdown,
  onDownloadMarkdown,
  guardAdmin,
  markdownSpan,
  approvalState,
  groupStatus,
  exportValidation,
  userId,
  icebergItems = [],
  onJumpToEvidence,
  onActionClick,
}) => {
  const { ispRepo } = useIspRepositories();
  const { summary, guidance, narrative, actions, isLoading: isTimelineLoading } = useSupportPlanTimeline({
    userId: userId ? String(userId) : null,
    currentDraftData: form,
    ispRepo,
    icebergItems,
  });

  // Action Task Store
  const { tasks, promote, updateStatus } = useActionTaskStore();

  // マッチングロジック: ActionSuggestion[] と ActionTask[] (Store内) を stableId で紐付け
  const actionWithTasks = React.useMemo(() => {
    return actions.map(action => {
      const existingTask = Object.values(tasks).find(t => t.stableId === action.stableId);
      return {
        action,
        task: existingTask || null
      };
    });
  }, [actions, tasks]);

  const [docType, setDocType] = React.useState<'isp' | 'ibd'>('isp');

  // IBD専用 Markdown を計算
  const ibdMarkdown = React.useMemo(() => buildIbdSheetMarkdown(form), [form]);

  // 現在表示中のコンテンツ
  const activeMarkdown = docType === 'isp' ? ispMarkdown : ibdMarkdown;
  const docTitle = docType === 'isp' ? '個別支援計画書' : '強度行動障害支援計画シート';

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
        <TimelineSummaryCard 
          summary={summary}
          guidance={guidance}
          narrative={narrative}
          isLoading={isTimelineLoading}
          onJumpToEvidence={onJumpToEvidence}
        />
        <SupportPlanActionCard 
          actionWithTasks={actionWithTasks}
          onActionClick={onActionClick || (() => {})} 
          onPromote={promote}
          onUpdateStatus={updateStatus}
        />
        <ExportValidationCard validation={exportValidation} />
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          spacing={2}
          justifyContent="space-between"
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="doc-type-select-label">出力ドキュメント</InputLabel>
              <Select
                labelId="doc-type-select-label"
                value={docType}
                label="出力ドキュメント"
                onChange={(e) => setDocType(e.target.value as 'isp' | 'ibd')}
              >
                <MenuItem value="isp">個別支援計画 (ISP)</MenuItem>
                {groupStatus['ibd']?.isVisible && (
                  <MenuItem value="ibd">強度行動障害支援計画シート</MenuItem>
                )}
              </Select>
            </FormControl>

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

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={guardAdmin(() =>
                onDownloadMarkdown(activeMarkdown, `${activeDraftName}_${docType}.md`)
              )}
              disabled={!activeDraftName || !isAdmin}
            >
              保存 (.md)
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onCopyMarkdown(activeMarkdown)}
              disabled={!activeDraftName}
            >
              コピー
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<ArticleRoundedIcon />}
              onClick={() =>
                openPrintView(form, form.serviceUserName || activeDraftName || 'support-plan', printApproval)
              }
              disabled={!exportValidation.isExportable}
            >
              PDFプレビュー/印刷
            </Button>
          </Stack>
        </Stack>
        <Divider>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            PREVIEW: {docTitle}
          </Typography>
        </Divider>
        {previewMode === 'render' ? (
          <Box
            sx={{
              '& h2': { fontSize: 18, mt: 2 },
              '& p': { whiteSpace: 'pre-wrap' },
              '& ul': { pl: 4 },
            }}
          >
            <React.Suspense fallback={<LinearProgress sx={{ mt: 1 }} />}>
              <MarkdownPreview content={activeMarkdown} spanComplete={markdownSpan ?? undefined} />
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
            {activeMarkdown}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default React.memo(PreviewTab);
