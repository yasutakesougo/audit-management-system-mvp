/**
 * OpsDetailSupportFlags — 詳細パネル: 対応項目チェックリスト
 */

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';

export type OpsDetailSupportFlagsProps = {
  item: ScheduleOpsItem;
  canEdit: boolean;
  onToggle?: (flag: 'hasPickup' | 'hasMeal' | 'hasBath' | 'hasMedication' | 'hasOvernight', value: boolean) => void;
};

export const OpsDetailSupportFlags: FC<OpsDetailSupportFlagsProps> = ({ item, canEdit, onToggle }) => {
  const flags = [
    { key: 'hasPickup' as const, label: '送迎' },
    { key: 'hasMeal' as const, label: '食事' },
    { key: 'hasBath' as const, label: '入浴' },
    { key: 'hasMedication' as const, label: '服薬' },
    { key: 'hasOvernight' as const, label: '宿泊' },
  ];

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        対応項目
      </Typography>
      <FormGroup row>
        {flags.map(({ key, label }) => {
          const enabled = Boolean(item[key]);
          return (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  checked={enabled}
                  size="small"
                  disabled={!canEdit}
                  onChange={(e) => onToggle?.(key, e.target.checked)}
                />
              }
              label={<Typography variant="body2">{label}</Typography>}
            />
          );
        })}
      </FormGroup>
    </Box>
  );
};
