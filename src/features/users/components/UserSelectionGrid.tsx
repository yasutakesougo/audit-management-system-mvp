// ---------------------------------------------------------------------------
// UserSelectionGrid — 共有利用者選択コンポーネント
//
// 利用者カードのグリッドを表示し、選択時にコールバックを呼ぶ。
// ISPエディタ / 個別支援手順管理 など複数ページで再利用する。
// ---------------------------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSelectionItem {
  Id: number;
  UserID: string;
  FullName: string;
  IsHighIntensitySupportTarget?: boolean | null;
}

export interface UserSelectionGridProps {
  /** 表示する利用者リスト */
  users: UserSelectionItem[];
  /** カード選択時のコールバック（UserID を返す） */
  onSelect: (userCode: string) => void;
  /** グリッド上部のタイトル（省略時はデフォルト） */
  title?: string;
  /** グリッド上部のサブタイトル（省略時はデフォルト） */
  subtitle?: string;
  /** 行動分析対象者を優先表示するか（デフォルト: true） */
  prioritizeIBD?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UserSelectionGrid: React.FC<UserSelectionGridProps> = ({
  users,
  onSelect,
  title = '対象利用者を選択してください',
  subtitle,
  prioritizeIBD = true,
}) => {
  // 行動分析対象者を先頭に表示
  const sortedUsers = React.useMemo(() => {
    if (!prioritizeIBD) return users;
    return [...users].sort((a, b) => {
      const aIBD = a.IsHighIntensitySupportTarget ? 1 : 0;
      const bIBD = b.IsHighIntensitySupportTarget ? 1 : 0;
      return bIBD - aIBD; // 行動分析対象者が先
    });
  }, [users, prioritizeIBD]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {sortedUsers.map((user) => {
          const isIBD = Boolean(user.IsHighIntensitySupportTarget);
          return (
            <Card
              key={user.Id}
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: isIBD ? 'warning.main' : undefined,
                borderWidth: isIBD ? 2 : 1,
              }}
            >
              <CardActionArea
                onClick={() => onSelect(user.UserID)}
                sx={{ p: 2 }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <PersonIcon
                    sx={{
                      fontSize: 48,
                      color: isIBD ? 'warning.main' : 'primary.main',
                      mb: 1,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {user.FullName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 1, flexWrap: 'wrap' }}>
                    <Chip label={user.UserID} size="small" variant="outlined" />
                    {isIBD && (
                      <Chip
                        icon={<StarIcon />}
                        label="行動分析対象"
                        size="small"
                        color="warning"
                        variant="filled"
                      />
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      {users.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            利用者が登録されていません。
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default UserSelectionGrid;
