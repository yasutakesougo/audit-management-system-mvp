import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import IconButton from '@mui/material/IconButton';

import type { ExportValidationResult } from '../../types/export';

export type ExportValidationCardProps = {
  validation: ExportValidationResult;
};

export const ExportValidationCard: React.FC<ExportValidationCardProps> = ({ validation }) => {
  const [expanded, setExpanded] = React.useState(validation.blockCount > 0);

  const { isExportable, blockCount, warnCount, issues } = validation;

  const severity = blockCount > 0 ? 'error' : warnCount > 0 ? 'warning' : 'success';
  const icon = blockCount > 0 ? <ErrorOutlineRoundedIcon /> : warnCount > 0 ? <WarningAmberRoundedIcon /> : <CheckCircleOutlineRoundedIcon />;
  
  const title = isExportable 
    ? (warnCount > 0 ? '出力可能ですが、一部見直しを推奨します' : '公式様式への出力準備が整いました')
    : '必須項目が不足しているため、出力が制限されています';

  return (
    <Alert 
      severity={severity} 
      icon={icon}
      sx={{ 
        '& .MuiAlert-message': { width: '100%' },
        borderRadius: 2
      }}
      action={
        issues.length > 0 && (
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
          </IconButton>
        )
      }
    >
      <AlertTitle sx={{ fontWeight: 'bold' }}>
        {title}
      </AlertTitle>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {blockCount > 0 && <Chip size="small" color="error" label={`必須欠落: ${blockCount}`} variant="outlined" />}
        {warnCount > 0 && <Chip size="small" color="warning" label={`見直し推奨: ${warnCount}`} variant="outlined" />}
        {isExportable && blockCount === 0 && warnCount === 0 && (
          <Chip size="small" color="success" label="All Checks Passed" variant="outlined" />
        )}
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, borderTop: '1px border-solid rgba(0,0,0,0.1)', pt: 1 }}>
          <List dense disablePadding>
            {issues.map((issue, idx) => (
              <ListItem key={idx} sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {issue.severity === 'block' ? (
                    <ErrorOutlineRoundedIcon fontSize="small" color="error" />
                  ) : (
                    <WarningAmberRoundedIcon fontSize="small" color="warning" />
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                      {issue.label}: {issue.message}
                    </Typography>
                  }
                  secondary={
                    issue.actual !== undefined && issue.max !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        現在: {issue.actual} / 制限: {issue.max}文字
                      </Typography>
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Collapse>
    </Alert>
  );
};
