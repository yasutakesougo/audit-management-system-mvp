import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Alert,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TerminalIcon from '@mui/icons-material/Terminal';
import { useSpHealthSignal } from '../hooks/useSpHealthSignal';
import { readEnv } from '@/lib/env';

/**
 * SpRemediationCard
 * 
 * 現在検知されている SpHealthSignal に付随する
 * 「修復アクション（CLIコマンド等）」を提示するカード。
 */
export const SpRemediationCard: React.FC = () => {
  const signal = useSpHealthSignal();
  const siteUrl = readEnv('VITE_SP_SITE_URL', 'https://[YOUR-TENANT].sharepoint.com/sites/[YOUR-SITE]');

  if (!signal || !signal.remediation) {
    return null;
  }

  const { remediation } = signal;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // シンプルな通知（実動作では Toast 等が望ましいが、ここでは alert/console で代用）
      console.log('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // コマンド内の環境変数プレースホルダを置換
  const processedCommands = remediation.commands.map(cmd => 
    cmd.replace(/\$SITE_URL/g, siteUrl)
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: remediation.isDestructive ? 'error.light' : 'primary.light',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: '100%',
          bgcolor: remediation.isDestructive ? 'error.main' : 'primary.main',
        }
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: remediation.isDestructive ? 'error.50' : 'primary.50',
              color: remediation.isDestructive ? 'error.main' : 'primary.main',
              display: 'flex',
            }}
          >
            <TerminalIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }}>
              推奨アクション: {remediation.summary}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              以下の CLI コマンドを実行して環境を修復してください。
            </Typography>
          </Box>
        </Stack>

        <Divider />

        {remediation.caution && (
          <Alert 
            severity={remediation.isDestructive ? 'error' : 'warning'} 
            icon={<WarningAmberIcon fontSize="inherit" />}
            sx={{ 
              py: 0, 
              '& .MuiAlert-message': { fontSize: '0.75rem', fontWeight: 600 } 
            }}
          >
            注意: {remediation.caution}
          </Alert>
        )}

        <Stack spacing={1}>
          {processedCommands.map((cmd, idx) => (
            <Paper
              key={idx}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: 'grey.50',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderStyle: 'dashed',
              }}
            >
              <Box sx={{ overflowX: 'auto', mr: 2, whiteSpace: 'nowrap' }}>
                {cmd}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {remediation.isDestructive && (
                  <Chip
                    label="dry-run 推奨"
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: 'error.main',
                      borderColor: 'error.light',
                      bgcolor: 'error.50',
                    }}
                  />
                )}
                <Tooltip title="コピー">
                  <Button
                    size="small"
                    onClick={() => copyToClipboard(cmd)}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </Button>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontStyle: 'italic' }}>
          ※ m365 CLI (v7+) を使用した修復案です
        </Typography>
      </Stack>
    </Paper>
  );
};
