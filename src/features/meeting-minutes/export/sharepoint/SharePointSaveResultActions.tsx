import React from 'react';
import { Box, Button, Typography, Alert, Snackbar } from '@mui/material';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import type { MeetingMinutesSharePointSaveResult } from './useMeetingMinutesSharePointExport';
import { useMeetingMinutesTeamsShare } from '../teams/useMeetingMinutesTeamsShare';
import type { HandoffAudience } from '../../editor/handoffTemplates';

export type SharePointSaveResultActionsProps = {
  result: MeetingMinutesSharePointSaveResult | null;
  onClear?: () => void;
  // 以下は Teams共有文面の構築に必要なメタ情報
  title?: string;
  meetingDate?: string;
  audience?: HandoffAudience;
};

/**
 * SharePointSaveResultActions.tsx
 *
 * 責務:
 * - SharePoint に保存した成果物（HTML / PDF）に対する次のアクション（開く・コピー）を提供する
 */
export function SharePointSaveResultActions({ result, onClear, title, meetingDate, audience }: SharePointSaveResultActionsProps) {
  const [copyFeedback, setCopyFeedback] = React.useState(false);
  const [copyTextFeedback, setCopyTextFeedback] = React.useState(false);
  
  const { shareToTeams, copyTeamsShareText } = useMeetingMinutesTeamsShare();

  if (!result) return null;

  const handleCopy = async () => {
    if (!result.linkUrl) return;
    try {
      await navigator.clipboard.writeText(result.linkUrl);
      setCopyFeedback(true);
    } catch {
      // clipboad copy fallback if needed, but modern browsers support this in secure context
      prompt('以下のURLをコピーしてください:', result.linkUrl);
    }
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Alert 
        severity="success" 
        onClose={onClear}
        sx={{
          '.MuiAlert-message': { width: '100%' }
        }}
      >
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            SharePointに保存済み（印刷用HTML）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {result.fileName}
          </Typography>
        </Box>
        
        {result.linkUrl && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={async () => {
                if (!result.linkUrl) return;
                try {
                  await shareToTeams({
                    title,
                    meetingDate,
                    audience,
                    fileName: result.fileName,
                    sharePointUrl: result.linkUrl,
                  });
                } catch {
                  // error is caught cleanly
                }
              }}
            >
              Teamsで共有
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={async () => {
                if (!result.linkUrl) return;
                await copyTeamsShareText({
                  title,
                  meetingDate,
                  audience,
                  fileName: result.fileName,
                  sharePointUrl: result.linkUrl,
                });
                setCopyTextFeedback(true);
              }}
            >
              共有文面をコピー
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<FileOpenIcon />}
              href={result.linkUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              保存先を開く
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={handleCopy}
            >
              URLをコピー
            </Button>
          </Box>
        )}
      </Alert>

      <Snackbar
        open={copyFeedback}
        autoHideDuration={3000}
        onClose={() => setCopyFeedback(false)}
        message="URLをコピーしました"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      
      <Snackbar
        open={copyTextFeedback}
        autoHideDuration={4000}
        onClose={() => setCopyTextFeedback(false)}
        message="共有用の文面をコピーしました。Teamsなどに貼り付けてください。"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
