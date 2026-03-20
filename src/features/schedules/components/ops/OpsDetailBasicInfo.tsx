/**
 * OpsDetailBasicInfo — 詳細パネル: 基本情報
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import { toOpsServiceType } from '../../domain/scheduleOps';
import type { ScheduleOpsItem } from '../../domain/scheduleOpsSchema';
import { OpsServiceTypeChip } from './OpsServiceTypeChip';
import { OpsStatusBadge } from './OpsStatusBadge';

const formatTimeRange = (start?: string | null, end?: string | null): string => {
  const fmt = (iso: string | null | undefined): string => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
};

export type OpsDetailBasicInfoProps = {
  item: ScheduleOpsItem;
};

export const OpsDetailBasicInfo: FC<OpsDetailBasicInfoProps> = ({ item }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Title & Status */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h6" fontWeight="bold">
          {item.userName ?? item.title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <OpsServiceTypeChip serviceType={toOpsServiceType(item.serviceType)} />
          <OpsStatusBadge status={item.opsStatus} />
        </Box>
      </Box>

      {/* Time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <AccessTimeIcon fontSize="small" />
        <Typography variant="body2">{formatTimeRange(item.start, item.end)}</Typography>
      </Box>

      {/* Staff */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <PersonIcon fontSize="small" />
        <Typography variant="body2">
          担当: {item.assignedStaffName ?? '未設定'}
        </Typography>
      </Box>
    </Box>
  );
};
