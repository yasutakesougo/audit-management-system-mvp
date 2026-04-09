/**
 * MonitoringEvidencePanel — エビデンス引用セクション
 *
 * 日次記録エビデンス + Iceberg PDCA 分析結果引用 + 再分析リンク をまとめて表示。
 * MonitoringTab.tsx 内のインラインコンポーネントを独立化。
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
import { todayYmd, minusDaysYmd } from '../../utils/helpers';

// ── 日次記録エビデンス ─────────────────────────────────

type DailyEvidenceProps = {
  userId: string;
  onAppend: (text: string) => void;
  isAdmin: boolean;
};

const DailyEvidenceSection: React.FC<DailyEvidenceProps> = ({ userId, onAppend, isAdmin }) => {
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
                日々の記録エビデンス（過去60日: {evidence.count}件）
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

// ── Iceberg PDCA 分析結果引用 ──────────────────────────

type IcebergEvidenceProps = {
  userId: string;
  onAppend: (text: string) => void;
  isAdmin: boolean;
};

const IcebergEvidenceSection: React.FC<IcebergEvidenceProps> = ({ userId, onAppend, isAdmin }) => {
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

// ── メインパネル ───────────────────────────────────────

export type MonitoringEvidencePanelProps = {
  userId: string;
  isAdmin: boolean;
  onAppendDailyEvidence: (text: string) => void;
  onAppendIcebergEvidence: (text: string) => void;
};

const MonitoringEvidencePanel: React.FC<MonitoringEvidencePanelProps> = ({
  userId,
  isAdmin,
  onAppendDailyEvidence,
  onAppendIcebergEvidence,
}) => {
  const navigate = useNavigate();

  return (
    <>
      <DailyEvidenceSection
        userId={userId}
        isAdmin={isAdmin}
        onAppend={onAppendDailyEvidence}
      />
      <IcebergEvidenceSection
        userId={userId}
        isAdmin={isAdmin}
        onAppend={onAppendIcebergEvidence}
      />
      <Box sx={{ mt: 1 }}>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={<BubbleChartIcon />}
          onClick={() => navigate(buildIcebergPdcaUrl(userId, { source: 'monitoring' }))}
          data-testid="monitoring-reanalysis-link"
        >
          再分析する
        </Button>
      </Box>
    </>
  );
};

export default React.memo(MonitoringEvidencePanel);
