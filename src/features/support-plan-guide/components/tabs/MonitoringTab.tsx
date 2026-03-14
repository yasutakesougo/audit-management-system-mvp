/**
 * MonitoringTab — モニタリングタブ
 *
 * SectionKey: 'monitoring'
 * プレゼンテーショナルコンポーネント（状態・副作用なし）。
 *
 * 他のセクションタブと異なり、MonitoringEvidenceSection を条件付きで描画する。
 * Phase 1: MonitoringDailyDashboard を前段に配置し、客観指標を可視化する。
 */
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
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
import MonitoringDailyDashboard from '@/features/monitoring/components/MonitoringDailyDashboard';
import { useMonitoringDailyAnalytics } from '@/features/monitoring/hooks/useMonitoringDailyAnalytics';
import type { MonitoringEvidenceSectionProps, ToastState } from '../../types';
import { findSection, minusDaysYmd, todayYmd } from '../../utils/helpers';
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
                日次記録エビデンス（過去60日: {evidence.count}件）
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
            一覧入力テーブルから自動集計された実績です。モニタリング評価文の根拠として引用できます。
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

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, setToast, ...sectionProps }) => {
  const navigate = useNavigate();
  const section = findSection('monitoring');

  const userIdStr = userId ? String(userId) : '';
  const { summary, insightLines, recordCount } = useMonitoringDailyAnalytics(userIdStr);

  /** monitoringPlan フィールドへの追記共通ヘルパー */
  const appendToMonitoringPlan = React.useCallback(
    (text: string, duplicateMsg: string, successMsg: string) => {
      const currentVal = sectionProps.form.monitoringPlan || '';
      const headerLine = text.split('\n')[0];
      if (currentVal.includes(headerLine)) {
        setToast({ open: true, message: duplicateMsg, severity: 'info' });
        return;
      }
      sectionProps.onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
      setToast({ open: true, message: successMsg, severity: 'success' });
    },
    [sectionProps, setToast],
  );

  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* Phase 1: 集計ダッシュボード（新規） */}
      {userIdStr && (
        <MonitoringDailyDashboard
          summary={summary}
          insightLines={insightLines}
          recordCount={recordCount}
          isAdmin={sectionProps.isAdmin}
          onAppendInsight={(text) =>
            appendToMonitoringPlan(
              text,
              'この期間の所見は既に引用されています。',
              '所見ドラフトを引用しました。内容を調整してください。',
            )
          }
        />
      )}

      {/* 既存: 日次記録エビデンス（生データ引用） */}
      {userId && (
        <MonitoringEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) =>
            appendToMonitoringPlan(
              text,
              'この期間のエビデンスは既に引用されています。',
              'エビデンスを引用しました。内容を調整してください。',
            )
          }
        />
      )}

      {/* 既存: Iceberg PDCA 引用 */}
      {userId && (
        <IcebergEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) =>
            appendToMonitoringPlan(
              text,
              'Iceberg分析結果は既に引用されています。',
              'Iceberg分析結果を引用しました。内容を調整してください。',
            )
          }
        />
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
