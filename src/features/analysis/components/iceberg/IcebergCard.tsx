import type { IcebergNode } from '@/features/analysis/domain/icebergTypes';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import React from 'react';

type Props = {
  node: IcebergNode;
  isSelected: boolean;
  onPointerDown: (event: React.PointerEvent, nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

export const IcebergCard: React.FC<Props> = ({ node, isSelected, onPointerDown, onSelect }) => {
  const theme = useTheme();

  const colorMap = {
    behavior: {
      bg: '#ffebee',
      border: theme.palette.error.main,
      text: theme.palette.error.dark,
    },
    assessment: {
      bg: '#e3f2fd',
      border: theme.palette.info.main,
      text: theme.palette.info.dark,
    },
    environment: {
      bg: '#f1f8e9',
      border: theme.palette.success.main,
      text: theme.palette.success.dark,
    },
  } as const;

  const style = colorMap[node.type];

  const typeLabel = (() => {
    if (node.type === 'behavior') return '行動 (結果)';
    if (node.type === 'assessment') return '特性 (要因)';
    return '環境因子';
  })();

  const truncatedDetails = node.details && node.details.length > 60 ? `${node.details.slice(0, 60)}…` : node.details;

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 220,
        bgcolor: style.bg,
        borderColor: isSelected ? 'primary.main' : style.border,
        borderWidth: isSelected ? 2 : 1,
        zIndex: isSelected ? 10 : 1,
        cursor: 'default',
        boxShadow: isSelected ? 4 : 1,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        userSelect: 'none',
        touchAction: 'none',
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
          p: 0.5,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
        }}
        onPointerDown={(event) => onPointerDown(event, node.id)}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', mr: 1 }} />
        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ flexGrow: 1 }}>
          {typeLabel}
        </Typography>
      </Box>

      <CardContent sx={{ py: 0, pb: '12px !important', px: 1.5 }}>
        <Typography variant="subtitle2" fontWeight="bold" color={style.text} sx={{ lineHeight: 1.3 }}>
          {node.label}
        </Typography>
        {truncatedDetails && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
            {truncatedDetails}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
