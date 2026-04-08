import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import { GovernanceDecision } from '../../governance/governanceEngine';
import { presentGovernanceDecision } from '../../governance/governancePresenter';

export interface GovernanceBadgeProps {
  decision: GovernanceDecision;
}

/**
 * GovernanceBadge — 自律ガバナンスの判定結果（自動修復・提案等）を表示する
 */
export const GovernanceBadge: React.FC<GovernanceBadgeProps> = ({ decision }) => {
  const ui = presentGovernanceDecision(decision);
  
  // MUIの標準カラーにマッピング
  const muiColor = ui.badgeColor === 'blue' ? 'primary' : 
                   ui.badgeColor === 'yellow' ? 'warning' : 
                   ui.badgeColor === 'red' ? 'error' : 'default';

  return (
    <Tooltip title={ui.statusDescription} arrow>
      <Chip
        icon={<GavelIcon sx={{ fontSize: '14px !important' }} />}
        label={ui.badgeLabel}
        size="small"
        color={muiColor}
        variant="outlined"
        sx={{ 
          height: 24, 
          fontSize: '0.7rem', 
          fontWeight: 600,
          borderColor: ui.badgeColor === 'blue' ? 'primary.main' : undefined,
          '& .MuiChip-icon': {
            marginLeft: '4px'
          }
        }}
      />
    </Tooltip>
  );
};
