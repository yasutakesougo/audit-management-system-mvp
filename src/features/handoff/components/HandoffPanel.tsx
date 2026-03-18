import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, Chip, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useHandoff } from '../hooks/useHandoff';
import { HandoffComposerDialog } from './HandoffComposerDialog';

export type HandoffPanelProps = {
  /** YYYY-MM-DD */
  targetDate: string;
};

export const HandoffPanel: React.FC<HandoffPanelProps> = ({ targetDate }) => {
  const { handoffs, loadHandoffsByDate, markHandoffAsRead } = useHandoff();
  const [openComposer, setOpenComposer] = useState(false);

  useEffect(() => {
    if (targetDate) {
      loadHandoffsByDate(targetDate);
    }
  }, [targetDate, loadHandoffsByDate]);

  const handleMarkAsRead = async (id: string) => {
    await markHandoffAsRead(id);
    await loadHandoffsByDate(targetDate);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="bold">
          今日の申し送り
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setOpenComposer(true)}
        >
          申し送り追加
        </Button>
      </Stack>
      
      <Stack spacing={2}>
        {handoffs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            本日の申し送りはありません。
            <br />
            必要な申し送りがあれば「申し送り追加」から登録できます。
          </Typography>
        )}
        {handoffs.map((h) => {
          const isUnread = h.status === 'unread';
          const isHigh = h.priority === 'high' || h.priority === 'emergency';

          return (
            <Card
              key={h.id}
              variant="outlined"
              sx={{
                bgcolor: isUnread ? (isHigh ? 'error.50' : 'info.50') : 'background.paper',
                borderLeft: isUnread ? 4 : 1,
                borderColor: isUnread ? (isHigh ? 'error.main' : 'info.main') : 'divider',
              }}
            >
              <CardContent sx={{ pb: '16px !important' }}>
                <Stack direction="row" spacing={1} mb={1} alignItems="center" flexWrap="wrap">
                  {isUnread ? (
                    <Chip label="未読" size="small" color="primary" />
                  ) : (
                    <Chip label="確認済み" size="small" variant="outlined" color="default" sx={{ opacity: 0.7 }} />
                  )}
                  {h.priority === 'emergency' && <Chip label="緊急" size="small" color="error" />}
                  {h.priority === 'high' && <Chip label="重要" size="small" color="warning" />}
                  {h.priority === 'normal' && <Chip label="通常" size="small" color="default" />}
                  <Typography variant="body2" fontWeight="bold">
                    {h.userId || '全体共有'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    記録: {h.reporterName}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: isUnread ? undefined : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {h.content}
                </Typography>
                {isUnread && (
                  <Box mt={2} textAlign="right">
                    <Button
                      size="small"
                      startIcon={<CheckCircleOutlineIcon />}
                      onClick={() => handleMarkAsRead(h.id)}
                    >
                      確認済み
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
      
      {openComposer && (
        <HandoffComposerDialog 
          open={openComposer} 
          onClose={() => setOpenComposer(false)} 
          targetDate={targetDate}
          onSaved={() => loadHandoffsByDate(targetDate)}
        />
      )}
    </Box>
  );
};
