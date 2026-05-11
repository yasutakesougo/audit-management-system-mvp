import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useMonitoringKioskAnalytics } from '../hooks/useMonitoringKioskAnalytics';

export interface KioskMonitoringEvidencePanelProps {
  userId: string;
  onAppendInsight: (text: string) => void;
  isAdmin: boolean;
}

/**
 * キオスク記録（17手順）の集計を表示するモニタリング用エビデンスパネル
 */
const KioskMonitoringEvidencePanel: React.FC<KioskMonitoringEvidencePanelProps> = ({
  userId,
  onAppendInsight,
  isAdmin,
}) => {
  const [justAppended, setJustAppended] = React.useState(false);
  const { summary, insightLines, loading } = useMonitoringKioskAnalytics(userId, 90);

  const handleAppend = React.useCallback(() => {
    onAppendInsight(insightLines.join('\n'));
    setJustAppended(true);
    setTimeout(() => setJustAppended(false), 3000);
  }, [onAppendInsight, insightLines]);

  if (loading) {
    return (
      <Box sx={{ mt: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">キオスク記録（17手順）を集計中...</Typography>
        </Paper>
      </Box>
    );
  }

  if (!summary || summary.totalRecords === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={2}>
           {/* ヘッダー */}
           <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" rowGap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AssessmentIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2" component="span" color="secondary">
                キオスク記録（17手順）統計
              </Typography>
            </Stack>
            <Button
              size="small"
              variant={justAppended ? 'outlined' : 'contained'}
              color={justAppended ? 'success' : 'secondary'}
              startIcon={<ContentCopyRoundedIcon />}
              onClick={handleAppend}
              disabled={!isAdmin || insightLines.length === 0}
            >
              {justAppended ? '引用しました ✓' : '統計と傾向を引用'}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            対象期間: {summary.period.from} 〜 {summary.period.to}（計{summary.totalRecords}件の実施記録）
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1 }}>
            {summary.procedures.map(p => (
              <Paper key={p.scheduleItemId} variant="outlined" sx={{ p: 1, bgcolor: 'background.paper' }}>
                <Typography variant="caption" fontWeight="bold" display="block" noWrap title={p.activityName}>
                  {p.activityName}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Chip label={`実 ${p.completedCount}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                  {p.triggeredCount > 0 && (
                    <Chip label={`発 ${p.triggeredCount}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                  )}
                  {p.skippedCount > 0 && (
                    <Chip label={`スキ ${p.skippedCount}`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                  )}
                  {p.memoCount > 0 && (
                    <Chip label={`メモ ${p.memoCount}`} size="small" color="info" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" fontWeight="bold" display="block" gutterBottom color="text.secondary">
              記録から見える傾向（ドラフト）
            </Typography>
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 1,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                whiteSpace: 'pre-wrap',
                fontSize: '0.8rem',
                lineHeight: 1.6,
              }}
            >
              {insightLines.join('\n')}
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default React.memo(KioskMonitoringEvidencePanel);
