import { useUsers } from '@/stores/useUsers';
import { TESTIDS } from '@/testids';
import {
    AccessTime as AccessTimeIcon,
    Cancel as CancelIcon,
    ClearAll as ClearAllIcon,
    ExpandMore as ExpandMoreIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    Person as PersonIcon,
    Save as SaveIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useMemo, useState } from 'react';

// Types
interface BulkActivityData {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  commonActivities: {
    amActivities: string[];
    pmActivities: string[];
    amNotes: string;
    pmNotes: string;
  };
  individualNotes: Record<string, {
    amNotes?: string;
    pmNotes?: string;
    specialNotes?: string;
    problemBehavior?: {
      selfHarm: boolean;
      violence: boolean;
      loudVoice: boolean;
      pica: boolean;
      other: boolean;
      otherDetail: string;
    };
  }>;
}

interface BulkDailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: BulkActivityData, selectedUserIds: string[]) => Promise<void>;
}

export function BulkDailyRecordForm({
  open,
  onClose,
  onSave
}: BulkDailyRecordFormProps) {
  // State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<BulkActivityData>({
    date: new Date().toISOString().split('T')[0],
    reporter: {
      name: '',
      role: '生活支援員'
    },
    commonActivities: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: ''
    },
    individualNotes: {}
  });
  const [newActivityAM, setNewActivityAM] = useState('');
  const [newActivityPM, setNewActivityPM] = useState('');
  const [saving, setSaving] = useState(false);

  // Data
  const { data: users = [] } = useUsers();

  // Filtered users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.userId?.toLowerCase().includes(query) ||
      user.furigana?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Selected users data
  const selectedUsers = useMemo(() => {
    return users.filter(user => selectedUserIds.includes(user.userId || ''));
  }, [users, selectedUserIds]);

  // Event handlers
  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev => {
      const newIds = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];

      // Initialize individual notes for new users
      if (!prev.includes(userId)) {
        setFormData(prevData => ({
          ...prevData,
          individualNotes: {
            ...prevData.individualNotes,
            [userId]: {}
          }
        }));
      }

      return newIds;
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredUsers.map(user => user.userId || '');
    setSelectedUserIds(allIds);

    // Initialize individual notes for all users
    const newIndividualNotes: Record<string, object> = {};
    allIds.forEach(id => {
      newIndividualNotes[id] = {};
    });

    setFormData(prev => ({
      ...prev,
      individualNotes: {
        ...prev.individualNotes,
        ...newIndividualNotes
      }
    }));
  };

  const handleClearAll = () => {
    setSelectedUserIds([]);
  };

  const handleAddActivity = (period: 'AM' | 'PM') => {
    const newActivity = period === 'AM' ? newActivityAM : newActivityPM;
    if (newActivity.trim()) {
      const field = period === 'AM' ? 'amActivities' : 'pmActivities';
      setFormData(prev => ({
        ...prev,
        commonActivities: {
          ...prev.commonActivities,
          [field]: [...prev.commonActivities[field], newActivity.trim()]
        }
      }));
      if (period === 'AM') {
        setNewActivityAM('');
      } else {
        setNewActivityPM('');
      }
    }
  };

  const handleRemoveActivity = (period: 'AM' | 'PM', index: number) => {
    const field = period === 'AM' ? 'amActivities' : 'pmActivities';
    setFormData(prev => ({
      ...prev,
      commonActivities: {
        ...prev.commonActivities,
        [field]: prev.commonActivities[field].filter((_, i) => i !== index)
      }
    }));
  };

  const handleIndividualNoteChange = (userId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      individualNotes: {
        ...prev.individualNotes,
        [userId]: {
          ...prev.individualNotes[userId],
          [field]: value
        }
      }
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
      await onSave(formData, selectedUserIds);
      onClose();
      // Reset form
      setSelectedUserIds([]);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        reporter: { name: '', role: '生活支援員' },
        commonActivities: { amActivities: [], pmActivities: [], amNotes: '', pmNotes: '' },
        individualNotes: {}
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
      maxWidth="lg"
      fullWidth
      keepMounted
      data-testid={TESTIDS['bulk-daily-record-form']}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GroupIcon />
          複数利用者支援記録（ケース記録）作成
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          複数の利用者に対して共通の活動記録を効率的に作成できます
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
                  name="reporterRole"
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
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  inputProps: {
                    'data-testid': TESTIDS['bulk-daily-record-search']
                  }
                }}
                sx={{ flexGrow: 1 }}
              />
              <Tooltip title="表示中の利用者を全選択">
                <IconButton
                  aria-label="表示中の利用者を全選択"
                  data-testid={TESTIDS['bulk-daily-record-select-all']}
                  onClick={handleSelectAll}
                >
                  <PersonAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="選択をクリア">
                <IconButton
                  aria-label="選択をクリア"
                  data-testid={TESTIDS['bulk-daily-record-clear-all']}
                  onClick={handleClearAll}
                >
                  <ClearAllIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* 選択状況 */}
            {selectedUserIds.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedUserIds.length}人の利用者が選択されています
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {selectedUsers.slice(0, 5).map(user => (
                      <Chip
                        key={user.userId}
                        label={user.name}
                        size="small"
                        onDelete={() => handleUserToggle(user.userId || '')}
                      />
                    ))}
                    {selectedUsers.length > 5 && (
                      <Chip label={`他${selectedUsers.length - 5}人`} size="small" />
                    )}
                  </Stack>
                </Box>
              </Alert>
            )}

            {/* 利用者リスト */}
            <Box
              sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}
              data-testid={TESTIDS['bulk-daily-record-user-list']}
            >
              {filteredUsers.map(user => (
                <FormControlLabel
                  key={user.userId}
                  data-testid={`${TESTIDS['bulk-daily-record-user-row-prefix']}${user.userId || user.id}`}
                  control={
                    <Checkbox
                      checked={selectedUserIds.includes(user.userId || '')}
                      onChange={() => handleUserToggle(user.userId || '')}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        {user.name} ({user.userId})
                      </Typography>
                      {user.furigana && (
                        <Typography variant="caption" color="textSecondary">
                          {user.furigana}
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{
                    width: '100%',
                    margin: 0,
                    px: 1,
                    py: 0.5,
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                  }}
                />
              ))}
              {filteredUsers.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
                  該当する利用者が見つかりません
                </Typography>
              )}
            </Box>
          </Paper>

          {/* 共通活動記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              共通活動記録
            </Typography>

            <Stack spacing={2}>
              {/* 午前の活動 */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">午前の活動</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="活動内容を入力"
                          value={newActivityAM}
                          onChange={(e) => setNewActivityAM(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddActivity('AM');
                            }
                          }}
                          sx={{ flexGrow: 1 }}
                          InputProps={{
                            inputProps: {
                              'data-testid': TESTIDS['bulk-daily-record-activity-input-am']
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => handleAddActivity('AM')}
                          disabled={!newActivityAM.trim()}
                        >
                          追加
                        </Button>
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {formData.commonActivities.amActivities.map((activity, index) => (
                          <Chip
                            key={`${activity}-${index}`}
                            label={activity}
                            onDelete={() => handleRemoveActivity('AM', index)}
                            size="small"
                            data-testid={`${TESTIDS['bulk-daily-record-activity-chip-am']}-${index}`}
                            deleteIcon={(
                              <CancelIcon
                                fontSize="small"
                                data-testid={`${TESTIDS['bulk-daily-record-activity-delete-am']}-${index}`}
                              />
                            )}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="午前の共通メモ"
                      value={formData.commonActivities.amNotes}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        commonActivities: { ...prev.commonActivities, amNotes: e.target.value }
                      }))}
                      placeholder="午前中の様子や特記事項（全員共通）"
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* 午後の活動 */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">午後の活動</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="活動内容を入力"
                          value={newActivityPM}
                          onChange={(e) => setNewActivityPM(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddActivity('PM');
                            }
                          }}
                          sx={{ flexGrow: 1 }}
                          InputProps={{
                            inputProps: {
                              'data-testid': TESTIDS['bulk-daily-record-activity-input-pm']
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => handleAddActivity('PM')}
                          disabled={!newActivityPM.trim()}
                        >
                          追加
                        </Button>
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {formData.commonActivities.pmActivities.map((activity, index) => (
                          <Chip
                            key={`${activity}-${index}`}
                            label={activity}
                            onDelete={() => handleRemoveActivity('PM', index)}
                            size="small"
                            data-testid={`${TESTIDS['bulk-daily-record-activity-chip-pm']}-${index}`}
                            deleteIcon={(
                              <CancelIcon
                                fontSize="small"
                                data-testid={`${TESTIDS['bulk-daily-record-activity-delete-pm']}-${index}`}
                              />
                            )}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="午後の共通メモ"
                      value={formData.commonActivities.pmNotes}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        commonActivities: { ...prev.commonActivities, pmNotes: e.target.value }
                      }))}
                      placeholder="午後の様子や特記事項（全員共通）"
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </Paper>

          {/* 個別メモ */}
          {selectedUsers.length > 0 && (
            <Paper sx={{ p: 2 }} data-testid={TESTIDS['bulk-daily-record-individual-notes']}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                個別メモ（必要に応じて入力）
              </Typography>
              <Stack spacing={2}>
                {selectedUsers.map(user => (
                  <Card key={user.userId} variant="outlined">
                    <CardContent sx={{ pb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {user.name} ({user.userId})
                      </Typography>
                      <Stack spacing={1}>
                        <TextField
                          fullWidth
                          size="small"
                          label="個別特記事項"
                          value={formData.individualNotes[user.userId || '']?.specialNotes || ''}
                          onChange={(e) => handleIndividualNoteChange(user.userId || '', 'specialNotes', e.target.value)}
                          placeholder="この利用者特有の記録事項があれば入力"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
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