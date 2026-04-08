import type { IcebergNode } from '@/features/ibd/analysis/iceberg/icebergTypes';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import LightbulbCircleRoundedIcon from '@mui/icons-material/LightbulbCircleRounded';
import HomeWorkRoundedIcon from '@mui/icons-material/HomeWorkRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import { TESTIDS, tidWithSuffix } from '@/testids';
import React from 'react';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); }
  100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
`;

type Props = {
  node: IcebergNode;
  isSelected: boolean;
  onPointerDown: (event: React.PointerEvent, nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  isMeetingMode?: boolean;
};

export const IcebergCard: React.FC<Props> = ({ 
  node, isSelected, onPointerDown, onSelect, isMeetingMode = false 
}) => {
  const theme = useTheme();

  const colorMap = {
    behavior: {
      bg: alpha('#fff5f5', 0.9),
      border: '#ffc1cc',
      text: '#c62828',
      icon: <WarningAmberRoundedIcon sx={{ fontSize: 16, mr: 0.5, color: '#c62828' }} />,
      glow: alpha('#ff1744', 0.15),
    },
    assessment: {
      bg: alpha('#f0f7ff', 0.9),
      border: '#b3d7ff',
      text: '#1565c0',
      icon: <LightbulbCircleRoundedIcon sx={{ fontSize: 16, mr: 0.5, color: '#1565c0' }} />,
      glow: alpha('#2979ff', 0.15),
    },
    environment: {
      bg: alpha('#f4fff4', 0.9),
      border: '#b9e5b9',
      text: '#2e7d32',
      icon: <HomeWorkRoundedIcon sx={{ fontSize: 16, mr: 0.5, color: '#2e7d32' }} />,
      glow: alpha('#00e676', 0.1),
    },
  } as const;

  const style = colorMap[node.type];

  // カードヘッダーのテキストラベル (色覚差や反射への対応)
  const headerLabel = (() => {
    switch (node.type) {
      case 'behavior': return '行動 (結果)';
      case 'assessment': return '内の要因';
      case 'environment': return '環境要因';
      default: return '';
    }
  })();

  const truncatedDetails = node.details && node.details.length > 60 ? `${node.details.slice(0, 60)}…` : node.details;

  return (
    <Card
      {...tidWithSuffix(TESTIDS['iceberg-card-item'], node.id)}
      variant="outlined"
      className={isSelected ? 'iceberg-card-selected' : ''}
      sx={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 240,
        bgcolor: style.bg,
        backdropFilter: 'blur(8px)',
        borderColor: isSelected ? 'primary.main' : style.border,
        borderWidth: isSelected ? 2 : 1.5,
        zIndex: isSelected ? 10 : 1,
        cursor: 'default',
        boxShadow: isSelected 
          ? `0 8px 32px ${style.glow}, 0 4px 12px ${alpha(theme.palette.common.black, 0.1)}` 
          : `0 2px 8px ${alpha(theme.palette.common.black, 0.05)}`,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
        touchAction: 'none',
        borderRadius: 2.5,
        overflow: 'hidden',
        animation: isSelected && isMeetingMode ? `${pulse} 2s infinite` : 'none',
        '&:hover': {
          transform: (isSelected && isMeetingMode) ? 'scale(1.05)' : (isSelected ? 'none' : 'translateY(-2px)'),
          boxShadow: isSelected 
            ? `0 8px 32px ${alpha(style.glow, isMeetingMode ? 0.3 : 0.15)}` 
            : `0 4px 16px ${alpha(theme.palette.common.black, 0.1)}`,
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.75,
          cursor: isMeetingMode ? 'default' : 'grab',
          borderBottom: `1px solid ${alpha(style.border, 0.3)}`,
          '&:active': { cursor: isMeetingMode ? 'default' : 'grabbing' },
          bgcolor: alpha(style.text, 0.03),
        }}
        onPointerDown={(event) => !isMeetingMode && onPointerDown(event, node.id)}
      >
        {style.icon}
        <Typography 
          variant="caption" 
          fontWeight="900" 
          color={style.text} 
          sx={{ 
            flexGrow: 1, 
            letterSpacing: '0.08em',
            fontSize: '0.65rem',
            textTransform: 'uppercase'
          }}
        >
          {headerLabel}
        </Typography>
        {!isMeetingMode && <DragIndicatorIcon fontSize="small" sx={{ color: alpha(style.text, 0.3) }} />}
      </Box>

      <CardContent sx={{ py: 1.5, pb: '16px !important', px: 2 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.4, mb: 0.5 }}>
          {node.label}
        </Typography>
        {truncatedDetails && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.5, mb: 1 }}>
            {truncatedDetails}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Chip 
            label={node.status === 'fact' ? '事実' : node.status === 'validated' ? '検証済み' : '仮説'} 
            size="small" 
            sx={{ 
              fontSize: '0.6rem', 
              height: 18, 
              fontWeight: 'bold',
              bgcolor: node.status === 'fact' ? alpha('#2e7d32', 0.1) : node.status === 'validated' ? alpha('#1976d2', 0.1) : alpha('#ed6c02', 0.1),
              color: node.status === 'fact' ? '#1b5e20' : node.status === 'validated' ? '#0d47a1' : '#e65100',
              border: `1px solid ${node.status === 'fact' ? alpha('#2e7d32', 0.2) : node.status === 'validated' ? alpha('#1976d2', 0.2) : alpha('#ed6c02', 0.2)}`,
            }} 
          />
        </Box>
      </CardContent>
    </Card>
  );
};
