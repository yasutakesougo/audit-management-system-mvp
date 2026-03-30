import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';

import type { DailyGuidanceBundle } from '@/domain/isp/dailyBridge';

interface DailyGuidancePanelProps {
  bundle: DailyGuidanceBundle | null;
}

export const DailyGuidancePanel: React.FC<DailyGuidancePanelProps> = ({ bundle }) => {
  if (!bundle || bundle.items.length === 0) return null;

  const cautions = bundle.items.filter(i => i.type === 'caution');
  const procedures = bundle.items.filter(i => i.type === 'procedure');
  const focuses = bundle.items.filter(i => i.type === 'focus');
  const environments = bundle.items.filter(i => i.type === 'environmental');

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentIcon color="primary" />
        本日の支援ガイダンス（計画配備済み）
      </Typography>

      <Stack spacing={2}>
        {/* 緊急・注意点 (Caution) */}
        {cautions.length > 0 && (
          <Alert severity="error" icon={<WarningAmberIcon fontSize="inherit" />}>
            <AlertTitle>【最優先】安全・危機対応上の注意点</AlertTitle>
            {cautions.map(item => (
              <Box key={item.id} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">{item.title}</Typography>
                <Typography variant="body2">{item.content}</Typography>
              </Box>
            ))}
          </Alert>
        )}

        {/* 重点観察 (Focus) */}
        {focuses.length > 0 && (
          <Alert severity="info" icon={<VisibilityIcon fontSize="inherit" />}>
            <AlertTitle>今日の観察ポイント（モニタリング用）</AlertTitle>
            {focuses.map(item => (
              <Typography key={item.id} variant="body2">
                ・{item.content}
              </Typography>
            ))}
          </Alert>
        )}

        {/* 手順・環境 (Procedure / Environmental) */}
        <Card variant="outlined">
          <CardContent sx={{ p: '12px !important' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              実施手順・環境準備
            </Typography>
            <List dense disablePadding>
              {environments.map(item => (
                <ListItem key={item.id} disableGutters>
                  <ListItemText 
                    primary={item.title} 
                    secondary={item.content} 
                    primaryTypographyProps={{ variant: 'caption', fontWeight: 'bold', color: 'primary' }}
                  />
                </ListItem>
              ))}
              {procedures.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <ListItem disableGutters>
                    <ListItemText 
                      primary={item.title} 
                      secondary={item.content}
                    />
                  </ListItem>
                  {idx < procedures.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoIcon sx={{ fontSize: 12 }} />
            出典: 計画シート ID {bundle.items[0]?.provenance.planningSheetId} ({bundle.items[0]?.provenance.effectiveDate})
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};
