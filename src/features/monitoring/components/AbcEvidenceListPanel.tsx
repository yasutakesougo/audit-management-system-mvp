import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { AbcRecord } from '@/domain/abc/abcRecord';

export interface AbcEvidenceListPanelProps {
  records: AbcRecord[];
  loading: boolean;
  error: Error | null;
  period: {
    from: string;
    to: string;
    isProvisional: boolean;
    source: 'planning' | 'master' | 'fallback' | 'none';
  } | null;
}

export const AbcEvidenceListPanel: React.FC<AbcEvidenceListPanelProps> = ({
  records,
  loading,
  error,
  period,
}) => {
  if (loading) {
    return (
      <Card variant="outlined" sx={{ borderStyle: 'dashed', bgcolor: '#fbfcfe' }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" py={1}>
            <CircularProgress size={20} color="primary" />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Dedicated ABC 根拠候補を取得中...
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" variant="outlined" sx={{ borderRadius: 3 }}>
        Dedicated ABC 記録の取得に失敗しました: {error.message}
      </Alert>
    );
  }

  if (!period) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: '#93c5fd',
        bgcolor: '#f0f9ff',
        boxShadow: '0 2px 10px rgba(147, 197, 253, 0.08)',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* ヘッダー */}
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1} alignItems="center">
              <AssessmentRoundedIcon color="primary" />
              <Typography variant="subtitle2" fontWeight={800} color="primary.dark">
                評価対象期間の Dedicated ABC 記録（評価根拠候補）
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {period.isProvisional && (
                <Chip
                  label="暫定期間"
                  size="small"
                  color="warning"
                  variant="filled"
                  sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                />
              )}
              <Chip
                label={`期間: ${period.from} 〜 ${period.to}`}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
              />
            </Stack>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 14 }} />
            {period.source === 'planning' && '支援開始日（モニタリング起点）から算出された評価期間内の記録です。'}
            {period.source === 'master' && '支援計画に開始日がないため、利用者マスタの支援開始日から算出された評価期間内の記録です。'}
            {period.source === 'fallback' && '適用開始日仮設定に基づく、暫定的な評価期間内の記録です（監査エビデンスとしては確認が必要です）。'}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5, borderColor: '#bfdbfe' }} />

        {records.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" py={2} sx={{ fontStyle: 'italic' }}>
            この期間内に登録された Dedicated ABC 記録はありません。
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              登録済みの ABC 記録（全 {records.length} 件）:
            </Typography>

            <List disablePadding sx={{ maxHeight: 260, overflowY: 'auto', pr: 1 }}>
              {records.map((rec) => {
                const sourceContext = rec.sourceContext;
                const dateText = sourceContext?.date || rec.occurredAt.slice(0, 10);
                const slotId = sourceContext?.slotId;
                const slotText = slotId ? slotId.split('|')[1] || slotId : '（スロットなし）';

                const source = sourceContext?.source;
                const isKiosk = source === 'standalone' && sourceContext?.returnUrl?.includes('kiosk');

                let sourceLabel = '由来不明/旧データ';
                let sourceColor: 'default' | 'primary' | 'secondary' = 'default';

                if (source === 'daily-support') {
                  sourceLabel = '支援手順起点';
                  sourceColor = 'primary';
                } else if (source === 'standalone') {
                  if (isKiosk) {
                    sourceLabel = 'キオスク・支援手順起点';
                    sourceColor = 'secondary';
                  } else {
                    sourceLabel = '専用ABC画面起点';
                    sourceColor = 'secondary';
                  }
                }

                let intensityColor: 'default' | 'primary' | 'warning' | 'error' = 'default';
                let intensityText = '未入力';

                if (rec.intensity === 'high') {
                  intensityColor = 'error';
                  intensityText = '重度';
                } else if (rec.intensity === 'medium') {
                  intensityColor = 'warning';
                  intensityText = '中度';
                } else if (rec.intensity === 'low') {
                  intensityColor = 'primary';
                  intensityText = '軽度';
                }

                return (
                  <ListItem
                    key={rec.id}
                    divider
                    disableGutters
                    sx={{
                      py: 1,
                      alignItems: 'flex-start',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={700} color="text.primary">
                            {dateText}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {slotText}
                          </Typography>
                          <Chip
                            label={sourceLabel}
                            size="small"
                            color={sourceColor}
                            variant="outlined"
                            sx={{ height: 16, fontSize: '0.6rem', px: 0.5, '& .MuiChip-label': { px: 0.5 } }}
                          />
                          <Chip
                            label={`強度: ${intensityText}`}
                            size="small"
                            color={intensityColor}
                            sx={{ height: 16, fontSize: '0.6rem', px: 0.5, '& .MuiChip-label': { px: 0.5 } }}
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.25} sx={{ pl: 1, borderLeft: '2px solid #cbd5e1' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            <strong style={{ color: '#1e40af' }}>先行(A):</strong> {rec.antecedent || '未入力'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            <strong style={{ color: '#b91c1c' }}>行動(B):</strong> {rec.behavior || '未入力'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            <strong style={{ color: '#15803d' }}>結果(C):</strong> {rec.consequence || '未入力'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default AbcEvidenceListPanel;
