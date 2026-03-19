/**
 * OpsServiceTypeChip — サービス種別チップ
 *
 * 生活介護 / 一時ケア / ショートステイ を色 + ラベルで表示。
 * 色だけに依存せず、必ずラベルで識別可能にする。
 */

import Chip from '@mui/material/Chip';
import type { FC } from 'react';

import type { OpsServiceType } from '../../domain/scheduleOps';

// ─── Metadata ────────────────────────────────────────────────────────────────

type OpsServiceChipMeta = {
  readonly label: string;
  readonly color: 'info' | 'success' | 'warning';
};

const SERVICE_TYPE_CHIP_META: Record<OpsServiceType, OpsServiceChipMeta> = {
  normal: { label: '生活介護', color: 'info' },
  respite: { label: '一時ケア', color: 'success' },
  shortStay: { label: 'ショートステイ', color: 'warning' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsServiceTypeChipProps = {
  serviceType: OpsServiceType;
  size?: 'small' | 'medium';
};

export const OpsServiceTypeChip: FC<OpsServiceTypeChipProps> = ({
  serviceType,
  size = 'small',
}) => {
  const meta = SERVICE_TYPE_CHIP_META[serviceType];

  return (
    <Chip
      label={meta.label}
      color={meta.color}
      size={size}
      variant="filled"
      sx={{ fontWeight: 600, letterSpacing: '0.02em' }}
    />
  );
};
