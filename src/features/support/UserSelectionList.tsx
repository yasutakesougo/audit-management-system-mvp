import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import ViewIcon from '@mui/icons-material/Visibility';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserBasicInfo, sampleUsers } from '../../domain/support/individual-steps';
import { userCardSx } from '@/ui/density/userCardSx';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => Math.min(prev, filteredUsers.length - 1));
  }, [filteredUsers.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, filteredUsers.length]);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeIndex]);

  const confirmUser = (user: UserBasicInfo, index?: number) => {
    if (index !== undefined) {
      setActiveIndex(index);
    }
    onSelectUser?.(user);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName ?? '';
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
    if (filteredUsers.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const user = filteredUsers[activeIndex];
      if (user) {
        confirmUser(user);
      }
    }
  };

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
            inputRef={searchRef}
            fullWidth
            placeholder="利用者名、ふりがなで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setSearchQuery('');
                requestAnimationFrame(() => {
                  searchRef.current?.focus();
                });
                return;
              }
              if (event.key !== 'Enter') return;
              const nativeEvent = event.nativeEvent as { isComposing?: boolean } | undefined;
              if (nativeEvent?.isComposing) return;
              const user = filteredUsers[0];
              if (!user) return;
              event.preventDefault();
              confirmUser(user, 0);
            }}
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
        role="listbox"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
      >
        {filteredUsers.map((user, index) => {
          const age = calculateAge(user.birthDate);
          const isSelected = selectedUserId === user.id;
          const isActive = index === activeIndex;
          const isEmphasized = isSelected || isActive;

          return (
            <Box
              key={user.id}
              ref={(el) => {
                itemRefs.current[index] = el as HTMLDivElement | null;
              }}
              role="option"
              aria-selected={isEmphasized}
            >
              <Card
                sx={{
                  cursor: 'pointer',
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'grey.300',
                  ...userCardSx.card(isEmphasized),
                  backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                  '&:hover': {
                    backgroundColor: isSelected ? 'primary.100' : 'grey.50',
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out',
                  },
                }}
                onClick={() => confirmUser(user, index)}
              >
                <CardContent
                  sx={userCardSx.content}
                >
                  <Box display="flex" alignItems="center" mb={1}>
                    <Avatar
                      sx={{
                        ...userCardSx.avatar,
                        mr: 1.5,
                        bgcolor: isSelected ? 'primary.main' : 'grey.400',
                        fontSize: '1rem',
                      }}
                    >
                      {getInitials(user.name)}
                    </Avatar>

                    <Box flex={1} sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        component="div"
                        noWrap
                        sx={{ fontWeight: 600, ...userCardSx.name }}
                      >
                        {user.name}
                      </Typography>
                      {user.furigana && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={userCardSx.sub}
                        >
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
                          sx={userCardSx.iconButton}
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
            </Box>
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