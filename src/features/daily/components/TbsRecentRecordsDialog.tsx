/**
 * TBS — Recent behavior records dialog.
 */
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ABCRecord } from '@/domain/behavior';
import { AppliedStrategiesBadges } from '@/features/daily/components/AppliedStrategiesBadges';

export interface TbsRecentRecordsDialogProps {
  open: boolean;
  onClose: () => void;
  observations: ABCRecord[];
  userName?: string;
}

export const TbsRecentRecordsDialog: React.FC<TbsRecentRecordsDialogProps> = ({
  open,
  onClose,
  observations,
  userName,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="sm"
    data-testid="recent-records-dialog"
  >
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box display="flex" alignItems="center" gap={1}>
        直近の行動記録
        <Chip label={`${observations.length}件`} size="small" />
        {userName && (
          <Typography variant="body2" color="text.secondary">
            {userName}
          </Typography>
        )}
      </Box>
      <IconButton aria-label="閉じる" onClick={onClose} size="small">
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {observations.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          記録はまだありません。Planを確認してから記録を開始してください。
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {observations.slice(0, 10).map((observation) => (
            <Box key={observation.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                  {new Date(observation.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Chip
                  label={`${observation.behavior} / Lv.${observation.intensity}`}
                  color={observation.intensity >= 4 ? 'error' : observation.intensity >= 3 ? 'warning' : 'success'}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  A: {observation.antecedent ?? '―'} / C: {observation.consequence ?? '―'}
                </Typography>
              </Box>
              <AppliedStrategiesBadges strategies={observation.referencedStrategies} />
            </Box>
          ))}
        </Stack>
      )}
    </DialogContent>
  </Dialog>
);

export default TbsRecentRecordsDialog;
