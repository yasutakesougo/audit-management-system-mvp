import React from 'react';
import { Badge, IconButton, Tooltip } from '@mui/material';
import NotificationImportantRoundedIcon from '@mui/icons-material/NotificationImportantRounded';
import { useActionTaskStore, actionTaskSelectors } from '../hooks/useActionTaskStore';
import { useNavigate } from 'react-router-dom';

/**
 * P0AlertBadge - 全画面に表示される緊急タスク通知バッジ
 * 
 * 未完了のP0タスク（最優先事項）が存在する場合に赤色のバッジを表示します。
 * クリックすると Today ページのアクションセンターへ誘導します。
 */
export const P0AlertBadge: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useActionTaskStore((state) => state.tasks);
  const summary = actionTaskSelectors.getSummary(tasks);

  if (summary.critical === 0) return null;

  return (
    <Tooltip title={`${summary.critical}件の緊急対応事項があります`}>
      <IconButton 
        color="error" 
        onClick={() => navigate('/today')}
        size="small"
        sx={{ 
          p: 0.5,
          animation: 'pulse 2s infinite ease-in-out',
          '@keyframes pulse': {
            '0%': { transform: 'scale(1)', opacity: 1 },
            '50%': { transform: 'scale(1.15)', opacity: 0.8 },
            '100%': { transform: 'scale(1)', opacity: 1 },
          }
        }}
      >
        <Badge badgeContent={summary.critical} color="error">
          <NotificationImportantRoundedIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};
