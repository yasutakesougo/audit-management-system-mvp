/**
 * User Status Tab (利用者タブ)
 * 
 * 目的：利用者の登所・欠席・遅刻・早退を一覧表示
 * 
 * 表示内容：
 * - 欠席者リスト（理由、緊急連絡先）
 * - 遅刻・早退者リスト
 * - 今日登所している利用者の人数
 * - クリックで詳細モーダル表示（バイタル、特記事項など）
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { UserDetailDialog, type UserDetail } from '@/features/dashboard/dialogs/UserDetailDialog';

export interface UserStatusTabProps {
  /** 登所者数 */
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
}

/**
 * 利用者状況タブコンテンツ
 * Phase C-2: クリックで詳細モーダル表示
 */
export const UserStatusTab: React.FC<UserStatusTabProps> = ({
  attendeeCount,
  absentUsers,
  lateOrEarlyUsers,
}) => {
  // ✨ Phase C-2: モーダル制御
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleUserClick = (userId: string, userName: string, status: 'absent' | 'late' | 'early', reason?: string) => {
    // TODO: 実データから詳細情報を取得
    const userDetail: UserDetail = {
      id: userId,
      name: userName,
      status,
      reason,
      emergencyContacts: [
        // TODO: 実データから取得
        {
          name: '山田太郎',
          relationship: '家族（父）',
          phone: '090-1234-5678',
        },
      ],
      careFlags: status === 'absent' ? [
        {
          type: 'warning',
          label: '本日欠席',
          description: '必要に応じて家族に連絡してください',
        },
      ] : undefined,
      notes: 'アレルギー: 卵、服薬: 朝食後に血圧の薬',
    };
    setSelectedUser(userDetail);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          本日の登所状況
        </Typography>
        <Typography variant="body1" color="text.secondary">
          登所者数: <strong>{attendeeCount}名</strong>
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
                    transition: 'all 0.2s ease',
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
                    transition: 'all 0.2s ease',
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
