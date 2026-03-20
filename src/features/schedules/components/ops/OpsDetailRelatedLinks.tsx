/**
 * OpsDetailRelatedLinks — 詳細パネル: 関連記録リンク
 */

import LaunchIcon from '@mui/icons-material/Launch';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';

export type OpsDetailRelatedLinksProps = {
  item: ScheduleOpsItem;
};

export const OpsDetailRelatedLinks: FC<OpsDetailRelatedLinksProps> = ({ item }) => {
  if (!item.relatedRecordId) return null;

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        関連リンク
      </Typography>
      <Button
        variant="text"
        size="small"
        endIcon={<LaunchIcon />}
        sx={{ textTransform: 'none' }}
        onClick={() => {
          // TODO: 実際のルーティングに繋ぎこみ (Phase 3)
          // eslint-disable-next-line no-console
          console.log('Navigate to record:', item.relatedRecordId);
        }}
      >
        支援記録を開く
      </Button>
    </Box>
  );
};
