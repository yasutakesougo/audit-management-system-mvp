import {
    Add as AddIcon,
    Person as PersonIcon,
    Search as SearchIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    InputAdornment,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { UserBasicInfo, sampleUsers } from '../../domain/support/individual-steps';

interface UserSelectionListProps {
  users?: UserBasicInfo[];
  onSelectUser?: (user: UserBasicInfo) => void;
  onAddNewUser?: () => void;
  selectedUserId?: string;
}

export const UserSelectionList: React.FC<UserSelectionListProps> = ({
  users = sampleUsers,
  onSelectUser,
  onAddNewUser,
  selectedUserId
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // フィルタリング処理
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (!searchQuery) return user.isActive;

      const query = searchQuery.toLowerCase();
      return user.isActive && (
        user.name.toLowerCase().includes(query) ||
        (user.furigana && user.furigana.toLowerCase().includes(query))
      );
    });
  }, [users, searchQuery]);

  // 年齢計算
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 名前から初期を生成
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.charAt(0);
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          利用者選択
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddNewUser}
        >
          新規利用者登録
        </Button>
      </Box>

      {/* 検索バー */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="利用者名、ふりがなで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* 利用者一覧 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 2,
        }}
      >
        {filteredUsers.map((user) => {
          const age = calculateAge(user.birthDate);
          const isSelected = selectedUserId === user.id;

          return (
            <Card
              key={user.id}
              sx={{
                cursor: 'pointer',
                border: isSelected ? 2 : 1,
                borderColor: isSelected ? 'primary.main' : 'grey.300',
                backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                '&:hover': {
                  backgroundColor: isSelected ? 'primary.100' : 'grey.50',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out',
                },
              }}
              onClick={() => onSelectUser?.(user)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      mr: 2,
                      bgcolor: isSelected ? 'primary.main' : 'grey.400',
                      fontSize: '1.2rem',
                    }}
                  >
                    {getInitials(user.name)}
                  </Avatar>

                  <Box flex={1}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                      {user.name}
                    </Typography>
                    {user.furigana && (
                      <Typography variant="body2" color="text.secondary">
                        {user.furigana}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    {age !== null && (
                      <Chip
                        label={`${age}歳`}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                    )}
                    <Chip
                      icon={<PersonIcon />}
                      label="利用者"
                      size="small"
                      color="primary"
                      variant={isSelected ? 'filled' : 'outlined'}
                    />
                  </Box>

                  <Box>
                    <Tooltip title="支援手順を表示">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectUser?.(user);
                        }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* 検索結果が0件の場合 */}
      {filteredUsers.length === 0 && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" mb={1}>
                {searchQuery ? '該当する利用者が見つかりません' : '登録されている利用者がいません'}
              </Typography>
              <Typography variant="body2" color="text.disabled" mb={3}>
                {searchQuery
                  ? '検索条件を変更するか、新しい利用者を登録してください'
                  : '新しい利用者を登録してください'
                }
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddNewUser}
              >
                新規利用者登録
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 選択中の利用者情報 */}
      {selectedUserId && (
        <Box mt={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" color="primary.main" mb={1}>
                選択中の利用者
              </Typography>
              {(() => {
                const selectedUser = users.find(u => u.id === selectedUserId);
                if (!selectedUser) return null;

                return (
                  <Box display="flex" alignItems="center">
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                      {getInitials(selectedUser.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {selectedUser.name}
                      </Typography>
                      {selectedUser.furigana && (
                        <Typography variant="body2" color="text.secondary">
                          {selectedUser.furigana}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};