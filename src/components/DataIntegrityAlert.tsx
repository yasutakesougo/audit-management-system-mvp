import { env } from '@/lib/env';
import { translateZodIssue } from '@/lib/zodErrorUtils';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import { ZodError } from 'zod';

export interface DataIntegrityAlertProps {
  /** The Zod validation error to display */
  error: ZodError;
  /** Optional context label (e.g. 'users', 'daily', 'schedules') */
  context?: string;
  /** Callback when the alert is dismissed */
  onDismiss?: () => void;
}

/**
 * 管理者用データ整合性アラート。
 *
 * - 通常モード: 警告バナーのみ（具体的なフィールド情報は非表示）
 * - 管理者モード (VITE_AUDIT_DEBUG=true): 折りたたみ式の詳細パネルで
 *   各 ZodIssue の日本語翻訳、期待/実際型の技術情報を表示
 */
const DataIntegrityAlert: React.FC<DataIntegrityAlertProps> = ({
  error,
  context,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDebugMode = env.VITE_AUDIT_DEBUG;
  const issueCount = error.issues.length;

  const handleCopy = useCallback(async () => {
    const diagnosticText = [
      `--- データ整合性診断レポート ---`,
      `日時: ${new Date().toISOString()}`,
      context ? `コンテキスト: ${context}` : '',
      `エラー件数: ${issueCount}`,
      '',
      ...error.issues.map((iss, i) => [
        `[${i + 1}] ${translateZodIssue(iss)}`,
        `  パス: ${iss.path.join('.')}`,
        `  コード: ${iss.code}`,
        `  メッセージ: ${iss.message}`,
      ].join('\n')),
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      // eslint-disable-next-line no-console
      console.warn('[DataIntegrityAlert] clipboard API not available');
    }
  }, [error, context, issueCount]);

  return (
    <Alert
      severity="warning"
      data-testid="data-integrity-alert"
      action={
        onDismiss ? (
          <IconButton
            aria-label="閉じる"
            color="inherit"
            size="small"
            onClick={onDismiss}
            data-testid="data-integrity-dismiss"
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        ) : undefined
      }
      sx={{
        mb: 2,
        '& .MuiAlert-message': { width: '100%' },
      }}
    >
      <AlertTitle>
        ⚠ データ整合性チェック — {issueCount}件の不整合
        {context && (
          <Typography
            component="span"
            variant="body2"
            sx={{ ml: 1, color: 'text.secondary' }}
          >
            ({context})
          </Typography>
        )}
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: 1 }}>
        一部のデータが想定された形式と異なっています。
        {!isDebugMode && '管理者にお問い合わせください。'}
      </Typography>

      {isDebugMode && (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              }
              onClick={() => setExpanded(prev => !prev)}
              data-testid="data-integrity-toggle"
            >
              {expanded ? '詳細を閉じる' : '詳細を表示'}
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              data-testid="data-integrity-copy"
            >
              {copied ? 'コピー済み ✓' : '診断情報をコピー'}
            </Button>
          </Stack>

          <Collapse in={expanded} unmountOnExit data-testid="data-integrity-details">
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'warning.light',
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              <List dense disablePadding>
                {error.issues.map((issue, idx) => (
                  <ListItem
                    key={idx}
                    divider={idx < issueCount - 1}
                    sx={{ alignItems: 'flex-start', py: 1, px: 2 }}
                    data-testid={`data-integrity-issue-${idx}`}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                          {translateZodIssue(issue)}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" component="div" sx={{ mt: 0.5, color: 'text.secondary' }}>
                          パス: <code>{issue.path.join('.') || '(root)'}</code>
                          {' · '}
                          コード: <code>{issue.code}</code>
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Collapse>
        </>
      )}
    </Alert>
  );
};

export default DataIntegrityAlert;
