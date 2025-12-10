import { useUsers } from '@/stores/useUsers';
import { TESTIDS } from '@/testids';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';
import {
    ClearAll as ClearAllIcon,
    Clear as ClearIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    Person as PersonIcon,
    Save as SaveIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useMemo, useState } from 'react';

// Types
interface UserRowData {
  userId: string;
  userName: string;
  amActivity: string;
  pmActivity: string;
  lunchAmount: string;
  problemBehavior: {
    selfHarm: boolean;
    violence: boolean;
    loudVoice: boolean;
    pica: boolean;
    other: boolean;
  };
  specialNotes: string;
}

interface TableDailyRecordData {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  userRows: UserRowData[];
}

interface TableDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
}

const LUNCH_OPTIONS = ['完食', '8割', '半分', '少量', 'なし'];

export function TableDailyRecordForm({
  open,
  onClose,
  onSave
}: TableDailyRecordFormProps) {
  // State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectionManuallyEdited, setSelectionManuallyEdited] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(true); // 通所日フィルタ状態
  const [formData, setFormData] = useState<TableDailyRecordData>({
    date: new Date().toISOString().split('T')[0],
    reporter: {
      name: '',
      role: '生活支援員'
    },
    userRows: []
  });
  const [saving, setSaving] = useState(false);

  // Data
  const { data: users = [] } = useUsers();

  // Filtered users based on attendance first, then search
  const attendanceFilteredUsers = useMemo(() => {
    if (!showTodayOnly) {
      return users;
    }

    const targetDate = new Date(formData.date);
    return users.filter(user => {
      if (user.attendanceDays && Array.isArray(user.attendanceDays)) {
        return isUserScheduledForDate({
          Id: parseInt(user.userId || '0'),
          UserID: user.userId || '',
          FullName: user.name || '',
          AttendanceDays: user.attendanceDays
        }, targetDate);
      }
      // attendanceDaysが未設定の場合は毎日通所とみなす
      return true;
    });
  }, [users, showTodayOnly, formData.date]);

  const filteredUsers = useMemo(() => {
    let result = attendanceFilteredUsers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.name?.toLowerCase().includes(query) ||
        user.userId?.toLowerCase().includes(query) ||
        user.furigana?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [attendanceFilteredUsers, searchQuery]);

  // Selected users data
  const selectedUsers = useMemo(() => {
    return users.filter(user => selectedUserIds.includes(user.userId || ''));
  }, [users, selectedUserIds]);

  // Initialize user rows when selection changes
  React.useEffect(() => {
    const newUserRows = selectedUserIds.map(userId => {
      const user = users.find(u => u.userId === userId);
      const existingRow = formData.userRows.find(row => row.userId === userId);

      return existingRow || {
        userId,
        userName: user?.name || '',
        amActivity: '',
        pmActivity: '',
        lunchAmount: '',
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: false,
        },
        specialNotes: ''
      };
    });

    setFormData(prev => ({
      ...prev,
      userRows: newUserRows
    }));
  }, [selectedUserIds, users]);

  // Auto-update selected users when date changes and attendance filter is active
  React.useEffect(() => {
    if (showTodayOnly && selectedUserIds.length > 0) {
      const targetDate = new Date(formData.date);
      const validUserIds = selectedUserIds.filter(userId => {
        const user = users.find(u => u.userId === userId);
        if (!user || !user.attendanceDays || !Array.isArray(user.attendanceDays)) {
          return true; // 未設定の場合は保持
        }

        return isUserScheduledForDate({
          Id: parseInt(userId),
          UserID: userId,
          FullName: user.name || '',
          AttendanceDays: user.attendanceDays
        }, targetDate);
      });

      if (validUserIds.length !== selectedUserIds.length) {
        setSelectedUserIds(validUserIds);
      }
    }
  }, [formData.date, showTodayOnly, selectedUserIds, users]);

  React.useEffect(() => {
    if (!open) {
      setSelectionManuallyEdited(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !showTodayOnly || selectionManuallyEdited) {
      return;
    }

    const todayUserIds = attendanceFilteredUsers
      .map(user => user.userId)
      .filter((id): id is string => Boolean(id));

    if (todayUserIds.length === 0) {
      return;
    }

    const hasSameSelection = todayUserIds.length === selectedUserIds.length &&
      todayUserIds.every(id => selectedUserIds.includes(id));

    if (!hasSameSelection) {
      setSelectedUserIds(todayUserIds);
    }
  }, [open, showTodayOnly, attendanceFilteredUsers, selectionManuallyEdited, selectedUserIds]);

  // Event handlers
  const handleUserToggle = (userId: string) => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds(prev => {
      return prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredUsers
      .map(user => user.userId || '')
      .filter((id): id is string => Boolean(id));
    setSelectionManuallyEdited(true);
    setSelectedUserIds(allIds);
  };

  const handleClearAll = () => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds([]);
  };

  const handleRowDataChange = (userId: string, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      userRows: prev.userRows.map(row =>
        row.userId === userId
          ? { ...row, [field]: value }
          : row
      )
    }));
  };

  const handleProblemBehaviorChange = (userId: string, behaviorType: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      userRows: prev.userRows.map(row =>
        row.userId === userId
          ? {
              ...row,
              problemBehavior: {
                ...row.problemBehavior,
                [behaviorType]: checked
              }
            }
          : row
      )
    }));
  };

  const handleClearRow = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      userRows: prev.userRows.map(row =>
        row.userId === userId
          ? {
              ...row,
              amActivity: '',
              pmActivity: '',
              lunchAmount: '',
              problemBehavior: {
                selfHarm: false,
                violence: false,
                loudVoice: false,
                pica: false,
                other: false,
              },
              specialNotes: ''
            }
          : row
      )
    }));
  };

  const handleSave = async () => {
    if (selectedUserIds.length === 0) {
      alert('利用者を1人以上選択してください');
      return;
    }

    if (!formData.reporter.name.trim()) {
      alert('記録者名を入力してください');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
      // Reset form
      setSelectedUserIds([]);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        reporter: { name: '', role: '生活支援員' },
        userRows: []
      });
    } catch (error) {
      console.error('保存に失敗しました:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      data-testid={TESTIDS['daily-table-record-form']}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GroupIcon />
          一覧形式ケース記録入力
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          利用者を行として並べて、各項目を効率的に一覧入力できます
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* 基本情報 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              基本情報
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type="date"
                label="記録日"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                fullWidth
                label="記録者名"
                value={formData.reporter.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  reporter: { ...prev.reporter, name: e.target.value }
                }))}
                placeholder="記録者の氏名を入力"
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>役職</InputLabel>
                <Select
                  value={formData.reporter.role}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    reporter: { ...prev.reporter, role: e.target.value }
                  }))}
                  label="役職"
                >
                  <MenuItem value="生活支援員">生活支援員</MenuItem>
                  <MenuItem value="管理者">管理者</MenuItem>
                  <MenuItem value="看護師">看護師</MenuItem>
                  <MenuItem value="其他">其他</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {/* 利用者選択 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <GroupIcon sx={{ mr: 1 }} />
              利用者選択
            </Typography>

            {/* 検索・操作 */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                size="small"
                placeholder="名前またはIDで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ flexGrow: 1 }}
              />
              <Tooltip title="今日の通所者のみ表示">
                <Button
                  variant={showTodayOnly ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setShowTodayOnly(!showTodayOnly)}
                  sx={{ minWidth: 120, fontSize: '0.75rem' }}
                >
                  {showTodayOnly ? '通所日のみ' : '全利用者'}
                </Button>
              </Tooltip>
              <Tooltip title="表示中の利用者を全選択">
                <IconButton aria-label="表示中の利用者を全選択" onClick={handleSelectAll}>
                  <PersonAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="選択をクリア">
                <IconButton aria-label="選択をクリア" onClick={handleClearAll}>
                  <ClearAllIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* 選択状況・フィルタ状況 */}
            {showTodayOnly && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {new Date(formData.date).toLocaleDateString('ja-JP', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}の通所者のみ表示中（{filteredUsers.length}人）
              </Alert>
            )}
            {selectedUserIds.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedUserIds.length}人の利用者が選択されています（一覧表に表示されます）
              </Alert>
            )}

            {/* 利用者リスト（簡易表示） */}
            <Box
              data-testid={TESTIDS['daily-table-record-form-user-list']}
              sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}
            >
              {filteredUsers.map(user => (
                <Box
                  key={user.userId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                  }}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(user.userId || '')}
                    onChange={() => handleUserToggle(user.userId || '')}
                    size="small"
                    inputProps={{ 'aria-label': `${user.name} (${user.userId || 'ID未設定'})` }}
                  />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {user.name} ({user.userId})
                  </Typography>
                </Box>
              ))}
              {filteredUsers.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
                  該当する利用者が見つかりません
                </Typography>
              )}
            </Box>
          </Paper>

          {/* 一覧入力テーブル */}
          {selectedUsers.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                一覧入力テーブル
              </Typography>

              <TableContainer
                data-testid={TESTIDS['daily-table-record-form-table']}
                sx={{ maxHeight: 400 }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>利用者</TableCell>
                      <TableCell>午前活動</TableCell>
                      <TableCell>午後活動</TableCell>
                      <TableCell>昼食摂取</TableCell>
                      <TableCell>問題行動</TableCell>
                      <TableCell>特記事項</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.userRows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell>
                          <Typography variant="body2" sx={{ minWidth: 100 }}>
                            {row.userName}
                            <br />
                            <Typography variant="caption" color="textSecondary">
                              ({row.userId})
                            </Typography>
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="午前の活動"
                            value={row.amActivity}
                            onChange={(e) => handleRowDataChange(row.userId, 'amActivity', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' || e.key === 'Enter') {
                                // Tab移動を促進
                              }
                            }}
                            sx={{ minWidth: 150 }}
                          />
                        </TableCell>

                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="午後の活動"
                            value={row.pmActivity}
                            onChange={(e) => handleRowDataChange(row.userId, 'pmActivity', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' || e.key === 'Enter') {
                                // Tab移動を促進
                              }
                            }}
                            sx={{ minWidth: 150 }}
                          />
                        </TableCell>

                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={row.lunchAmount}
                              onChange={(e) => handleRowDataChange(row.userId, 'lunchAmount', e.target.value)}
                              displayEmpty
                            >
                              <MenuItem value="">選択</MenuItem>
                              {LUNCH_OPTIONS.map(option => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>

                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, minWidth: 150 }}>
                            {['selfHarm', 'violence', 'loudVoice', 'pica', 'other'].map(type => (
                              <Chip
                                key={type}
                                label={{
                                  selfHarm: '自傷',
                                  violence: '暴力',
                                  loudVoice: '大声',
                                  pica: '異食',
                                  other: 'その他'
                                }[type]}
                                size="small"
                                variant={row.problemBehavior[type as keyof typeof row.problemBehavior] ? 'filled' : 'outlined'}
                                clickable
                                onClick={() => handleProblemBehaviorChange(
                                  row.userId,
                                  type,
                                  !row.problemBehavior[type as keyof typeof row.problemBehavior]
                                )}
                                color={row.problemBehavior[type as keyof typeof row.problemBehavior] ? 'warning' : 'default'}
                              />
                            ))}
                          </Box>
                        </TableCell>

                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="特記事項"
                            value={row.specialNotes}
                            onChange={(e) => handleRowDataChange(row.userId, 'specialNotes', e.target.value)}
                            sx={{ minWidth: 200 }}
                            multiline
                            maxRows={2}
                          />
                        </TableCell>

                        <TableCell>
                          <Tooltip title="この行をクリア">
                            <IconButton
                              size="small"
                              aria-label="この行をクリア"
                              onClick={() => handleClearRow(row.userId)}
                            >
                              <ClearIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || selectedUserIds.length === 0}
          startIcon={<SaveIcon />}
        >
          {saving ? '保存中...' : `${selectedUserIds.length}人分保存`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}