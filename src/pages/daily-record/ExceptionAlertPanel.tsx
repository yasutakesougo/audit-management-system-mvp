import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import type { TriggeredException, ExceptionSeverity } from '@/domain/isp/exceptionBridge';

interface ExceptionAlertPanelProps {
  exceptions: TriggeredException[] | undefined;
}

export const ExceptionAlertPanel: React.FC<ExceptionAlertPanelProps> = ({ exceptions }) => {
  if (!exceptions || exceptions.length === 0) return null;

  // 重要度順にソート (critical > warning > info)
  const sorted = [...exceptions].sort((a, b) => {
    const score = { critical: 3, warning: 2, info: 1 };
    return score[b.severity] - score[a.severity];
  });

  const getIcon = (severity: ExceptionSeverity) => {
    switch (severity) {
      case 'critical': return <ErrorOutlineIcon />;
      case 'warning': return <WarningAmberIcon />;
      default: return <InfoOutlinedIcon />;
    }
  };

  const getSeverity = (severity: ExceptionSeverity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack spacing={1.5}>
        {sorted.map(exc => (
          <Alert 
            key={exc.id} 
            severity={getSeverity(exc.severity)}
            icon={getIcon(exc.severity)}
            variant="filled"
            sx={{ 
              borderRadius: 2,
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <AlertTitle sx={{ fontWeight: 'bold' }}>{exc.title}</AlertTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: '200px' }}>
                <Typography variant="body2" sx={{ mb: 0.5, opacity: 0.9 }}>
                  {exc.reason}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                  推奨アクション: {exc.suggestedAction}
                </Typography>
              </Box>
              <Button 
                size="small" 
                color="inherit" 
                variant="outlined"
                endIcon={<ArrowForwardIcon />}
                sx={{ 
                  whiteSpace: 'nowrap',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                対応する
              </Button>
            </Box>
          </Alert>
        ))}
      </Stack>
    </Box>
  );
};
