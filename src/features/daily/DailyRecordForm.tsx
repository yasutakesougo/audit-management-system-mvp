import {
    AccessTime as AccessTimeIcon,
    Delete as DeleteIcon,
    Person as PersonIcon,
    Restaurant as RestaurantIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { DailyAData, MealAmount, PersonDaily } from '../../domain/daily/types';

interface DailyRecordFormProps {
  open: boolean;
  onClose: () => void;
  record?: PersonDaily;
  onSave: (record: Omit<PersonDaily, 'id'>) => void;
}

const mealOptions = [
  { value: '完食' as const, label: '完食' },
  { value: '多め' as const, label: '多め' },
  { value: '半分' as const, label: '半分' },
  { value: '少なめ' as const, label: '少なめ' },
  { value: 'なし' as const, label: 'なし' }
];

// ダミーのユーザーデータ（32名の通所者）
const mockUsers = [
  { UserID: '001', FullName: '田中太郎' },
  { UserID: '002', FullName: '佐藤花子' },
  { UserID: '003', FullName: '鈴木次郎' },
  { UserID: '004', FullName: '高橋美咲' },
  { UserID: '005', FullName: '山田健一' },
  { UserID: '006', FullName: '渡辺由美' },
  { UserID: '007', FullName: '伊藤雄介' },
  { UserID: '008', FullName: '中村恵子' },
  { UserID: '009', FullName: '小林智子' },
  { UserID: '010', FullName: '加藤秀樹' },
  { UserID: '011', FullName: '吉田京子' },
  { UserID: '012', FullName: '清水達也' },
  { UserID: '013', FullName: '松本麻衣' },
  { UserID: '014', FullName: '森田健二' },
  { UserID: '015', FullName: '池田理恵' },
  { UserID: '016', FullName: '石井大輔' },
  { UserID: '017', FullName: '橋本真理' },
  { UserID: '018', FullName: '藤田和也' },
  { UserID: '019', FullName: '長谷川瞳' },
  { UserID: '020', FullName: '村上拓海' },
  { UserID: '021', FullName: '坂本彩香' },
  { UserID: '022', FullName: '岡田裕太' },
  { UserID: '023', FullName: '近藤美和' },
  { UserID: '024', FullName: '福田誠' },
  { UserID: '025', FullName: '前田愛' },
  { UserID: '026', FullName: '木村康平' },
  { UserID: '027', FullName: '内田千春' },
  { UserID: '028', FullName: '西川雅人' },
  { UserID: '029', FullName: '斎藤洋子' },
  { UserID: '030', FullName: '三浦大輔' },
  { UserID: '031', FullName: '小野寺美加' },
  { UserID: '032', FullName: '新井智也' }
];

export function DailyRecordForm({ open, onClose, record, onSave }: DailyRecordFormProps) {
  const users = mockUsers;

  const [formData, setFormData] = useState<Omit<PersonDaily, 'id'>>({
    personId: '',
    personName: '',
    date: new Date().toISOString().split('T')[0],
    status: '作成中',
    reporter: { name: '' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        violence: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: ''
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newActivityAM, setNewActivityAM] = useState('');
  const [newActivityPM, setNewActivityPM] = useState('');

  // レコードの初期化
  useEffect(() => {
    if (record) {
      setFormData({
        personId: record.personId,
        personName: record.personName,
        date: record.date,
        status: record.status,
        reporter: record.reporter,
        draft: record.draft,
        kind: 'A',
        data: record.data
      });
    } else {
      setFormData({
        personId: '',
        personName: '',
        date: new Date().toISOString().split('T')[0],
        status: '作成中',
        reporter: { name: '' },
        draft: { isDraft: true },
        kind: 'A',
        data: {
          amActivities: [],
          pmActivities: [],
          amNotes: '',
          pmNotes: '',
          mealAmount: '完食',
          problemBehavior: {
            selfHarm: false,
            violence: false,
            loudVoice: false,
            pica: false,
            other: false,
            otherDetail: ''
          },
          seizureRecord: {
            occurred: false,
            time: '',
            duration: '',
            severity: undefined,
            notes: ''
          },
          specialNotes: ''
        }
      });
    }
  }, [record, open]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

    const handleDataChange = (field: keyof DailyAData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: value
      }
    }));
  };

  const handleProblemBehaviorChange = (field: string, value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        problemBehavior: {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: false,
          otherDetail: '',
          ...prev.data.problemBehavior,
          [field]: value
        }
      }
    }));
  };

  const handleSeizureRecordChange = (field: string, value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        seizureRecord: {
          occurred: false,
          time: '',
          duration: '',
          severity: undefined,
          notes: '',
          ...prev.data.seizureRecord,
          [field]: value
        }
      }
    }));
  };

  const handleReporterChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      reporter: { ...prev.reporter, name: value }
    }));
  };

  const handlePersonChange = (personId: string) => {
    const selectedUser = users.find(user => user.UserID === personId);
    setFormData(prev => ({
      ...prev,
      personId,
      personName: selectedUser?.FullName || ''
    }));
  };

  const handleAddActivity = (period: 'AM' | 'PM') => {
    const newActivity = period === 'AM' ? newActivityAM : newActivityPM;
    if (newActivity.trim()) {
      const field = period === 'AM' ? 'amActivities' : 'pmActivities';
      setFormData(prev => ({
        ...prev,
        data: {
          ...prev.data,
          [field]: [...prev.data[field], newActivity.trim()]
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
      data: {
        ...prev.data,
        [field]: prev.data[field].filter((_: string, i: number) => i !== index)
      }
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.personId) {
      newErrors.personId = '利用者を選択してください';
    }
    if (!formData.date) {
      newErrors.date = '日付を入力してください';
    }
    if (!formData.reporter.name.trim()) {
      newErrors.reporter = '記録者名を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const selectedUser = users.find(user => user.UserID === formData.personId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        {record ? '日次記録の編集' : '新しい日次記録'}
        {selectedUser && (
          <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 1 }}>
            {selectedUser.FullName} ({selectedUser.UserID})
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* 基本情報 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              基本情報
            </Typography>

            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth error={!!errors.personId}>
                  <InputLabel>利用者</InputLabel>
                  <Select
                    value={formData.personId}
                    onChange={(e) => handlePersonChange(e.target.value)}
                    label="利用者"
                  >
                    {users.map((user) => (
                      <MenuItem key={user.UserID} value={user.UserID}>
                        {user.FullName} ({user.UserID})
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.personId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {errors.personId}
                    </Typography>
                  )}
                </FormControl>

                <TextField
                  fullWidth
                  label="日付"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.date}
                  helperText={errors.date}
                />
              </Stack>

              <TextField
                fullWidth
                label="記録者名"
                value={formData.reporter.name}
                onChange={(e) => handleReporterChange(e.target.value)}
                placeholder="記録者の氏名を入力"
                error={!!errors.reporter}
                helperText={errors.reporter}
              />
            </Stack>
          </Paper>

          {/* 午前の活動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              午前の活動
            </Typography>

            <Box sx={{ mb: 2 }}>
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
                {formData.data.amActivities.map((activity, index) => (
                  <Chip
                    key={index}
                    label={activity}
                    onDelete={() => handleRemoveActivity('AM', index)}
                    deleteIcon={<DeleteIcon />}
                    size="small"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="午前の記録・メモ"
              value={formData.data.amNotes || ''}
              onChange={(e) => handleDataChange('amNotes', e.target.value)}
              placeholder="午前中の様子や特記事項を記録"
            />
          </Paper>

          {/* 午後の活動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} />
              午後の活動
            </Typography>

            <Box sx={{ mb: 2 }}>
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
                {formData.data.pmActivities.map((activity, index) => (
                  <Chip
                    key={index}
                    label={activity}
                    onDelete={() => handleRemoveActivity('PM', index)}
                    deleteIcon={<DeleteIcon />}
                    size="small"
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="午後の記録・メモ"
              value={formData.data.pmNotes || ''}
              onChange={(e) => handleDataChange('pmNotes', e.target.value)}
              placeholder="午後の様子や特記事項を記録"
            />
          </Paper>

          {/* 食事記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <RestaurantIcon sx={{ mr: 1 }} />
              食事記録
            </Typography>

            <FormControl fullWidth>
              <InputLabel>食事摂取量</InputLabel>
              <Select
                value={formData.data.mealAmount || '完食'}
                onChange={(e) => handleDataChange('mealAmount', e.target.value as MealAmount)}
                label="食事摂取量"
              >
                {mealOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {/* 問題行動 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              問題行動
            </Typography>

            <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.data.problemBehavior?.selfHarm || false}
                    onChange={(e) => handleProblemBehaviorChange('selfHarm', e.target.checked)}
                  />
                }
                label="自傷"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.data.problemBehavior?.violence || false}
                    onChange={(e) => handleProblemBehaviorChange('violence', e.target.checked)}
                  />
                }
                label="暴力"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.data.problemBehavior?.loudVoice || false}
                    onChange={(e) => handleProblemBehaviorChange('loudVoice', e.target.checked)}
                  />
                }
                label="大声"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.data.problemBehavior?.pica || false}
                    onChange={(e) => handleProblemBehaviorChange('pica', e.target.checked)}
                  />
                }
                label="異食"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.data.problemBehavior?.other || false}
                    onChange={(e) => handleProblemBehaviorChange('other', e.target.checked)}
                  />
                }
                label="その他"
              />
            </Stack>

            {formData.data.problemBehavior?.other && (
              <TextField
                fullWidth
                label="その他詳細"
                value={formData.data.problemBehavior?.otherDetail || ''}
                onChange={(e) => handleProblemBehaviorChange('otherDetail', e.target.value)}
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            )}
          </Paper>

          {/* 発作記録 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              発作記録
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.data.seizureRecord?.occurred || false}
                  onChange={(e) => handleSeizureRecordChange('occurred', e.target.checked)}
                />
              }
              label="発作あり"
              sx={{ mb: 2 }}
            />

            {formData.data.seizureRecord?.occurred && (
              <Stack spacing={2}>
                <TextField
                  label="発作時刻"
                  type="time"
                  value={formData.data.seizureRecord?.time || ''}
                  onChange={(e) => handleSeizureRecordChange('time', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="持続時間"
                  placeholder="例：約5分"
                  value={formData.data.seizureRecord?.duration || ''}
                  onChange={(e) => handleSeizureRecordChange('duration', e.target.value)}
                />
                <FormControl>
                  <InputLabel>重症度</InputLabel>
                  <Select
                    value={formData.data.seizureRecord?.severity || ''}
                    onChange={(e) => handleSeizureRecordChange('severity', e.target.value)}
                    label="重症度"
                  >
                    <MenuItem value="軽度">軽度</MenuItem>
                    <MenuItem value="中等度">中等度</MenuItem>
                    <MenuItem value="重度">重度</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="発作メモ"
                  multiline
                  rows={2}
                  value={formData.data.seizureRecord?.notes || ''}
                  onChange={(e) => handleSeizureRecordChange('notes', e.target.value)}
                />
              </Stack>
            )}
          </Paper>

          {/* 特記事項 */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              特記事項
            </Typography>

            <TextField
              fullWidth
              label="特記事項"
              value={formData.data.specialNotes || ''}
              onChange={(e) => handleDataChange('specialNotes', e.target.value)}
              placeholder="その他の重要な情報や申し送り事項"
              multiline
              rows={3}
            />
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
        >
          {record ? '更新' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}