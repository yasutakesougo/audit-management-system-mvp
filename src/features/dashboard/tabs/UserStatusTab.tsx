/**
 * User Status Tab (利用者タブ)
 *
 * 目的：利用者の通所・欠席・遅刻・早退を一覧表示
 *
 * 表示内容：
 * - 欠席者リスト（理由、緊急連絡先）
 * - 遅刻・早退者リスト
 * - 今日通所している利用者の人数
 * - クリックで詳細モーダル表示（バイタル、特記事項など）
 */

import { motionTokens } from '@/app/theme';
import { EmptyState } from '@/features/dashboard/components/EmptyState';
import { UserDetailDialog, type UserDetail } from '@/features/dashboard/dialogs/UserDetailDialog';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface UserStatusTabProps {
  /** 通所者数 */
  attendeeCount: number;
  /** 欠席者リスト */
  absentUsers: Array<{
    id: string;
    name: string;
    reason?: string;
  }>;
  /** 遅刻・早退者リスト */
  lateOrEarlyUsers: Array<{
    id: string;
    name: string;
    type: 'late' | 'early';
  }>;
  /** ローディング中フラグ */
  loading?: boolean;
}

/**
 * 利用者状況タブコンテンツ
 * Phase C-2: クリックで詳細モーダル表示
 */
export const UserStatusTab: React.FC<UserStatusTabProps> = ({
  attendeeCount,
  absentUsers,
  lateOrEarlyUsers,
  loading = false,
}) => {
  const navigate = useNavigate();

  // ✨ Phase C-2: モーダル制御
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleUserClick = (userId: string, userName: string, status: 'absent' | 'late' | 'early', reason?: string) => {
    // 利用者詳細（実データ連携後は API から取得）
    const userDetail: UserDetail = {
      id: userId,
      name: userName,
      status,
      reason,
      emergencyContacts: [],
      notes: '詳細情報は利用者マスターを参照してください',
    };
    setSelectedUser(userDetail);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width={180} height={32} />
          <Skeleton variant="text" width={140} height={20} sx={{ mt: 1 }} />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width={160} height={28} />
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1, borderRadius: 1 }} />
          ))}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="rounded" height={48} sx={{ mb: 1, borderRadius: 1 }} />
        </Box>
      </Box>
    );
  }

  // ── Empty State ──
  const hasNoData = attendeeCount === 0 && absentUsers.length === 0 && lateOrEarlyUsers.length === 0;
  if (hasNoData) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          本日の通所状況
        </Typography>
        <EmptyState
          icon={<PeopleIcon />}
          title="利用者の通所情報がまだありません"
          description="出欠を登録すると、通所者数・欠席者・遅刻早退の情報がここに自動表示されます。"
          action={{
            label: '出欠を登録する',
            onClick: () => navigate('/attendance'),
          }}
          secondaryAction={{
            label: '利用者一覧を見る',
            onClick: () => navigate('/users'),
            variant: 'outlined',
          }}
          minHeight={280}
        />
      </Box>
    );
  }

  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          本日の通所状況
        </Typography>
        <Typography variant="body1" color="text.secondary">
          通所者数: <strong>{attendeeCount}名</strong>
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 欠席者リスト */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonOffIcon color="error" />
          欠席者 ({absentUsers.length}名)
        </Typography>
        {absentUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            本日の欠席者はいません
          </Typography>
        ) : (
          <List dense>
            {absentUsers.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  bgcolor: 'error.lighter',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    bgcolor: 'error.light',
                    cursor: 'pointer',
                    transform: 'translateY(-2px)',
                    transition: motionTokens.transition.hoverAll,
                  },
                }}
                onClick={() => handleUserClick(user.id, user.name, 'absent', user.reason)}  // ✨ クリックイベント
              >
                <ListItemIcon>
                  <PersonOffIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={user.name}
                  secondary={user.reason || '理由未記入'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 遅刻・早退者リスト */}
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon color="warning" />
          遅刻・早退 ({lateOrEarlyUsers.length}名)
        </Typography>
        {lateOrEarlyUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            本日の遅刻・早退者はいません
          </Typography>
        ) : (
          <List dense>
            {lateOrEarlyUsers.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  bgcolor: 'warning.lighter',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    bgcolor: 'warning.light',
                    cursor: 'pointer',
                    transform: 'translateY(-2px)',
                    transition: motionTokens.transition.hoverAll,
                  },
                }}
                onClick={() => handleUserClick(user.id, user.name, user.type)}  // ✨ クリックイベント
              >
                <ListItemIcon>
                  <AccessTimeIcon color="warning" />
                </ListItemIcon>
                <ListItemText primary={user.name} />
                <Chip
                  label={user.type === 'late' ? '遅刻' : '早退'}
                  size="small"
                  color="warning"
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* ✨ Phase C-2: 利用者詳細モーダル */}
      <UserDetailDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        user={selectedUser}
      />
    </Box>
  );
};
