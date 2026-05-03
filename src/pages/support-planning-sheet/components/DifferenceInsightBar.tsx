import React from 'react';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { TESTIDS } from '@/testids';
import type { IcebergSummary, DifferenceInsight } from '@/domain/isp/schema';

interface DifferenceInsightBarProps {
  icebergSummary?: IcebergSummary;
  differenceInsight?: DifferenceInsight;
  onOpenPreview?: () => void;
}

export const DifferenceInsightBar: React.FC<DifferenceInsightBarProps> = ({
  icebergSummary,
  differenceInsight,
  onOpenPreview,
}) => {
  if (!icebergSummary && (!differenceInsight || differenceInsight.changes.length === 0)) {
    return null;
  }

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      {icebergSummary && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 1.5, 
            bgcolor: alpha('#ed6c02', 0.04), 
            borderColor: alpha('#ed6c02', 0.2),
            borderRadius: 2
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InsightsRoundedIcon fontSize="small" />
              最新の氷山分析
            </Typography>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">行動</Typography>
              <Typography variant="body2" fontWeight={600}>{icebergSummary.primaryBehavior}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">要因</Typography>
              <Typography variant="body2" fontWeight={600}>{icebergSummary.primaryFactor}</Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.disabled">
              {new Date(icebergSummary.updatedAt).toLocaleDateString()} 更新
            </Typography>
          </Stack>
        </Paper>
      )}

      {differenceInsight && differenceInsight.changes.length > 0 && (
        <Paper 
          variant="outlined" 
          data-testid={TESTIDS.DIFFERENCE_INSIGHT_BAR}
          sx={{ 
            p: 1.5, 
            borderLeft: '4px solid #d32f2f',
            bgcolor: alpha('#d32f2f', 0.02),
            borderRadius: '0 8px 8px 0'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="caption" fontWeight={700} color="error.main" sx={{ letterSpacing: 1 }}>
                計画未反映の変更検知 (DIFFERENCE INSIGHT)
              </Typography>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                {differenceInsight.changes.map((change, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip 
                      label={change.label} 
                      size="small" 
                      color={change.level === 'high' ? 'error' : change.level === 'medium' ? 'warning' : 'default'}
                      variant="outlined" 
                      sx={{ height: 20, fontSize: '0.65rem' }} 
                    />
                    <Typography 
                      variant="body2" 
                      fontWeight={600} 
                      color={change.level === 'high' ? 'error.main' : change.level === 'medium' ? 'warning.main' : 'text.primary'}
                    >
                      {change.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
            
            <Button 
              variant="contained" 
              color="error" 
              size="small"
              onClick={onOpenPreview}
              sx={{ 
                borderRadius: 2,
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none', bgcolor: 'error.dark' }
              }}
            >
              反映内容を確認
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};
