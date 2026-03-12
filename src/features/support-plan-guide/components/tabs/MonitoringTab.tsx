/**
 * MonitoringTab — モニタリングタブ
 *
 * SectionKey: 'monitoring'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 *
 * 他のセクションタブと異なり、MonitoringEvidenceSection を条件付きで描画する。
 */
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

import { buildIcebergEvidence } from '@/features/ibd/analysis/pdca/icebergEvidenceAdapter';
import { useIcebergPdcaList } from '@/features/ibd/analysis/pdca/queries';
import { buildMonitoringEvidence } from '@/features/ibd/plans/support-plan/monitoringEvidenceAdapter';
import { computeDeadlineInfo, formatDateJP } from '@/features/ibd/plans/support-plan/supportPlanDeadline';
import { generateIcebergProposals } from '../../domain/proposalGenerator';
import type { MonitoringEvidenceSectionProps, ToastState } from '../../types';
import { findSection, minusDaysYmd, todayYmd } from '../../utils/helpers';
import { ProposalReviewSection } from '../ProposalReviewSection';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';

export type MonitoringTabProps = SectionTabProps & {
  /** アクティブドラフトのuserId（エビデンス取得用） */
  userId: string | number | null | undefined;
  /** トースト表示用 */
  setToast: (toast: ToastState) => void;
};

/** エビデンスセクション（内部コンポーネント） */
const MonitoringEvidenceSection: React.FC<MonitoringEvidenceSectionProps> = ({ userId, onAppend, isAdmin }) => {
  const range = React.useMemo(() => {
    const to = todayYmd();
    return { from: minusDaysYmd(to, 60), to }; // 過去60日
  }, []);

  const evidence = React.useMemo(() => {
    return buildMonitoringEvidence({ userId, range });
  }, [userId, range]);

  if (evidence.count === 0) return null;

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoStoriesIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                日次記録のエビデンス (過去60日: {evidence.count}件)
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppend(evidence.text)}
              disabled={!isAdmin}
            >
              評価文へ引用
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ※ 一覧入力テーブルから自動集計された実績です。アセスメントやモニタリングの根拠として活用できます。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {evidence.bullets.map((b: string, i: number) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={b}
                    primaryTypographyProps={{ variant: 'caption', sx: { display: 'block', lineHeight: 1.4 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

/** Iceberg PDCA 分析結果の引用セクション */
const IcebergEvidenceSection: React.FC<{
  userId: string;
  onAppend: (text: string) => void;
  isAdmin: boolean;
}> = ({ userId, onAppend, isAdmin }) => {
  const { data: pdcaItems = [] } = useIcebergPdcaList({ userId });

  const evidence = React.useMemo(
    () => buildIcebergEvidence({ userId, items: pdcaItems }),
    [userId, pdcaItems],
  );

  if (evidence.totalCount === 0) return null;

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <BubbleChartIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2" component="span" color="secondary">
                Iceberg PDCA 分析結果 ({evidence.actCount}件の改善 / 全{evidence.totalCount}件)
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppend(evidence.text)}
              disabled={!isAdmin}
              data-testid="iceberg-evidence-append"
            >
              評価文へ引用
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ※ Iceberg PDCA で記録された行動分析・改善内容です。ACT フェーズの改善が優先表示されます。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {evidence.bullets.map((b: string, i: number) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={b}
                    primaryTypographyProps={{ variant: 'caption', sx: { display: 'block', lineHeight: 1.4 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

/** Iceberg PDCA の ACT アイテムから生成された改善提案リスト */
const ProposalListFromIceberg: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: pdcaItems = [] } = useIcebergPdcaList({ userId });
  const proposals = React.useMemo(
    () => generateIcebergProposals({ userId, items: pdcaItems }),
    [userId, pdcaItems],
  );
  if (proposals.length === 0) return null;
  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <ProposalReviewSection proposals={proposals} />
    </Box>
  );
};

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, setToast, ...sectionProps }) => {
  const navigate = useNavigate();
  const section = findSection('monitoring');
  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {(() => {
        const deadline = computeDeadlineInfo({
          planPeriod: sectionProps.form.planPeriod ?? '',
          lastMonitoringDate: sectionProps.form.lastMonitoringDate ?? '',
        });
        const m = deadline.monitoring;
        if (m.daysLeft === undefined) return null;
        const severity = m.color === 'error' ? 'error' as const
          : m.color === 'warning' ? 'warning' as const
          : 'info' as const;
        const message = m.daysLeft < 0
          ? `➡ 次回モニタリング期限を ${Math.abs(m.daysLeft)}日超過しています（${formatDateJP(m.date)}）`
          : m.daysLeft <= 14
            ? `⚠ 次回モニタリング期限まであと ${m.daysLeft}日です（${formatDateJP(m.date)}）`
            : `✅ 次回モニタリング期限: ${formatDateJP(m.date)}（残り ${m.daysLeft}日）`;
        return (
          <Alert
            severity={severity}
            variant="outlined"
            sx={{ mb: 1 }}
            data-testid="monitoring-deadline-alert"
          >
            {message}
          </Alert>
        );
      })()}

      {userId && (
        <MonitoringEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) => {
            const currentVal = sectionProps.form.monitoringPlan || '';
            const headerLine = text.split('\n')[0];
            if (currentVal.includes(headerLine)) {
              setToast({ open: true, message: 'この期間のエビデンスは既に引用されています。', severity: 'info' });
              return;
            }
            sectionProps.onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
            setToast({ open: true, message: 'エビデンスを引用しました。内容を調整してください。', severity: 'success' });
          }}
        />
      )}

      {userId && (
        <IcebergEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) => {
            const currentVal = sectionProps.form.monitoringPlan || '';
            const headerLine = text.split('\n')[0];
            if (currentVal.includes(headerLine)) {
              setToast({ open: true, message: 'Iceberg分析結果は既に引用されています。', severity: 'info' });
              return;
            }
            sectionProps.onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
            setToast({ open: true, message: 'Iceberg分析結果を引用しました。内容を調整してください。', severity: 'success' });
          }}
        />
      )}

      {userId && (
        <ProposalListFromIceberg userId={String(userId)} />
      )}

      {userId && (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<BubbleChartIcon />}
            onClick={() => navigate(buildIcebergPdcaUrl(String(userId), { source: 'monitoring' }))}
            data-testid="monitoring-reanalysis-link"
          >
            再分析する
          </Button>
        </Box>
      )}

      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...sectionProps} />
        ))}
      </Stack>
    </Stack>
  );
};

export default React.memo(MonitoringTab);
