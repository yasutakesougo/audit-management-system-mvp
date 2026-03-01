import { DailyAData, MealAmount, PersonDaily } from '@/features/daily';
import {
    buildSpecialNotesFromImportantHandoffs,
    shouldAutoGenerateSpecialNotes,
    useImportantHandoffsForDaily
} from '@/features/handoff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyUserOption } from './index';
import { useDailyUserOptions } from './index';

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


// 「重要申し送り」から問題行動の候補を推定するための型
type ProblemBehaviorSuggestion = {
  selfHarm: boolean;
  violence: boolean;
  loudVoice: boolean;
  pica: boolean;
  other: boolean;
  otherDetail: string;
};

function buildProblemBehaviorSuggestion(
  handoffs: { message: string; category?: string }[]
): ProblemBehaviorSuggestion {
  const suggestion: ProblemBehaviorSuggestion = {
    selfHarm: false,
    violence: false,
    loudVoice: false,
    pica: false,
    other: false,
    otherDetail: ''
  };

  const text = handoffs.map(h => h.message).join('\n');

  // 自傷系
  if (text.match(/自傷|自分を叩く|頭を打つ|自分を殴る|自分.*叩く|自分.*打つ/)) {
    suggestion.selfHarm = true;
  }

  // 暴力・他害系
  if (text.match(/他害|職員.*殴る|職員.*蹴る|職員.*叩く|利用者.*殴る|利用者.*蹴る|利用者.*叩く|暴力/) && !suggestion.selfHarm) {
    suggestion.violence = true;
  }

  // 大声・奇声系
  if (text.match(/大声|叫ぶ|奇声|怒鳴る/)) {
    suggestion.loudVoice = true;
  }

  // 異食系
  if (text.match(/異食|口に入れる|拾い食い|食べてはいけないもの/)) {
    suggestion.pica = true;
  }

  // その他（今は「その他詳細」に文全体を入れるだけ、将来拡張可）
  if (!suggestion.selfHarm && !suggestion.violence && !suggestion.loudVoice && !suggestion.pica) {
    if (text.trim().length > 0) {
      suggestion.other = true;
      suggestion.otherDetail = '申し送り内容に基づく行動上の注意あり';
    }
  }

  return suggestion;
}

function isProblemBehaviorEmpty(pb: DailyAData['problemBehavior'] | undefined): boolean {
  if (!pb) return true;
  return (
    !pb.selfHarm &&
    !pb.violence &&
    !pb.loudVoice &&
    !pb.pica &&
    !pb.other &&
    !pb.otherDetail
  );
}

const createEmptyDailyRecord = (): Omit<PersonDaily, 'id'> => ({
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

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DailyRecordForm({ open, onClose, record, onSave }: DailyRecordFormProps) {
  const navigate = useNavigate();
  const { options: userOptions, findByPersonId } = useDailyUserOptions();

  const initialFormDataRef = useRef<string>('');

  const [formData, setFormData] = useState<Omit<PersonDaily, 'id'>>(
    () => createEmptyDailyRecord()
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newActivityAM, setNewActivityAM] = useState('');
  const [newActivityPM, setNewActivityPM] = useState('');

  // 問題行動の提案を一度使ったかどうか
  const [problemSuggestionApplied, setProblemSuggestionApplied] = useState(false);

  const selectedUserValue = useMemo<DailyUserOption | null>(() => {
    if (!formData.personId) {
      return null;
    }
    const matched = findByPersonId(formData.personId);
    if (matched) {
      return matched;
    }
    if (formData.personName) {
      return {
        id: formData.personId,
        label: formData.personName,
        lookupId: undefined,
        furigana: null,
      };
    }
    return null;
  }, [findByPersonId, formData.personId, formData.personName]);

  const todayYmd = todayYmdLocal();
  const dayScope = formData.date === todayYmd ? 'today' : 'yesterday';

  // 🔽 Phase 9: 重要な申し送りを取得
  const {
    items: importantHandoffs,
    loading: loadingHandoffs,
    error: handoffError,
    count: handoffCount
  } = useImportantHandoffsForDaily(formData.personId, formData.date);

  // Phase 11B: 問題行動の提案計算
  const problemSuggestion = useMemo(
    () =>
      importantHandoffs && importantHandoffs.length > 0
        ? buildProblemBehaviorSuggestion(importantHandoffs)
        : null,
    [importantHandoffs]
  );

  // レコードの初期化
  useEffect(() => {
    if (record) {
      const initial = {
        personId: record.personId,
        personName: record.personName,
        date: record.date,
        status: record.status,
        reporter: record.reporter,
        draft: record.draft,
        kind: record.kind,
        data: record.data
      };
      setFormData(initial);
      initialFormDataRef.current = JSON.stringify(initial);
    } else {
      const initial = createEmptyDailyRecord();
      setFormData(initial);
      initialFormDataRef.current = JSON.stringify(initial);
    }
  }, [record, open]);

  // P0防波堤: isDirty 判定
  const isDirty = useMemo(
    () => initialFormDataRef.current !== '' && JSON.stringify(formData) !== initialFormDataRef.current,
    [formData]
  );

  // P0防波堤: 未保存ガード付き閉じる処理
  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm('保存されていない変更があります。破棄して閉じますか？')) {
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  // P0防波堤: ブラウザ離脱時の警告
  useEffect(() => {
    if (!open) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [open, isDirty]);

  // 🔽 Phase 9: 特記事項 自動下書き用エフェクト
  useEffect(() => {
    // 条件:
    // - 編集ではなく「新規作成」のとき（record が undefined）
    // - 利用者が選択されている
    // - 重要な申し送りが1件以上ある
    // - 特記事項がまだ空
    if (
      shouldAutoGenerateSpecialNotes(
        !record,
        formData.personId,
        formData.data.specialNotes || '',
        handoffCount
      ) &&
      !loadingHandoffs &&
      !handoffError &&
      importantHandoffs
    ) {
      setFormData(prev => ({
        ...prev,
        data: {
          ...prev.data,
          specialNotes: buildSpecialNotesFromImportantHandoffs(
            importantHandoffs,
            prev.data.specialNotes || ''
          )
        }
      }));
    }
  }, [record, formData.personId, loadingHandoffs, importantHandoffs, handoffCount, handoffError]);

  const handleDateChange = (value: string) => {
    setFormData(prev => ({ ...prev, date: value }));
    if (errors.date) {
      setErrors(prev => ({ ...prev, date: '' }));
    }
  };

  // handleDataChangeのオーバーロード
  function handleDataChange(field: 'amActivities' | 'pmActivities', value: string[]): void;
  function handleDataChange(field: 'amNotes' | 'pmNotes' | 'specialNotes', value: string): void;
  function handleDataChange(field: 'mealAmount', value: MealAmount): void;
  function handleDataChange(field: keyof DailyAData, value: string | string[] | MealAmount) {
    setFormData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: value,
      },
    }));
  }

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

  const handlePersonChange = (option: DailyUserOption | null) => {
    setFormData(prev => ({
      ...prev,
      personId: option?.id ?? '',
      personName: option?.label ?? ''
    }));
    if (errors.personId) {
      setErrors(prev => ({ ...prev, personId: '' }));
    }
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

  // Phase 11B: 問題行動の提案を反映する処理
  const applyProblemBehaviorSuggestion = () => {
    if (!problemSuggestion) return;

    setFormData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        problemBehavior: {
          selfHarm:
            prev.data.problemBehavior?.selfHarm || problemSuggestion.selfHarm,
          violence:
            prev.data.problemBehavior?.violence || problemSuggestion.violence,
          loudVoice:
            prev.data.problemBehavior?.loudVoice || problemSuggestion.loudVoice,
          pica: prev.data.problemBehavior?.pica || problemSuggestion.pica,
          other: prev.data.problemBehavior?.other || problemSuggestion.other,
          otherDetail:
            prev.data.problemBehavior?.otherDetail ||
            problemSuggestion.otherDetail
        }
      }
    }));

    setProblemSuggestionApplied(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.personId) {
      newErrors.personId = '利用者の選択は必須です';
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

  // リアルタイムバリデーション：必須項目の入力状況をチェック
  const isFormValid = formData.personId && formData.date && formData.reporter.name.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
      data-testid="daily-record-form-dialog"
    >
      <DialogTitle data-testid="daily-record-form-title">
        {record ? '日次記録の編集' : '新しい日次記録'}
        {selectedUserValue && (
          <Typography
            variant="subtitle2"
            component="div"
            color="textSecondary"
            sx={{ mt: 1 }}
          >
            {selectedUserValue.label} ({selectedUserValue.id})
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers data-testid="daily-record-form-content">
        <Stack spacing={3}>
          {/* 基本情報 */}
          <Paper sx={{ p: 2 }} data-testid="basic-info-section">
            <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              基本情報
            </Typography>

            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={userOptions}
                  value={selectedUserValue}
                  onChange={(_, option) => handlePersonChange(option)}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  getOptionLabel={(option) =>
                    option.furigana
                      ? `${option.label}（${option.furigana}）`
                      : option.label
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="利用者の選択"
                      placeholder="氏名で検索してください"
                      helperText={errors.personId || '氏名から利用者を検索できます'}
                      error={!!errors.personId}
                    />
                  )}
                  data-testid="daily-record-user-picker"
                />

                <TextField
                  fullWidth
                  label="日付"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleDateChange(e.target.value)}
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

          {/* Phase 1B: 関連申し送りの可視化 */}
          {formData.personId && (
            <>
              {loadingHandoffs && (
                <Skeleton variant="rectangular" height={80} />
              )}

              {!loadingHandoffs && !handoffError && handoffCount > 0 && importantHandoffs?.length > 0 && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  data-testid="daily-related-handoffs"
                >
                  <AlertTitle sx={{ fontWeight: 600 }}>
                    📢 この利用者の重要な申し送り（{handoffCount}件）
                  </AlertTitle>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {importantHandoffs.slice(0, 3).map(handoff => (
                      <Box
                        key={handoff.id}
                        sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                      >
                        <Chip
                          size="small"
                          label={handoff.category}
                          color="primary"
                          sx={{ minWidth: 60 }}
                        />
                        <Typography variant="body2">
                          {handoff.message}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            ({handoff.time})
                          </Typography>
                        </Typography>
                      </Box>
                    ))}
                    {handoffCount > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        ... 他 {handoffCount - 3}件
                      </Typography>
                    )}
                  </Stack>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => {
                      navigate('/handoff-timeline', {
                        state: {
                          dayScope,
                          timeFilter: 'all'
                        }
                      });
                    }}
                    sx={{ mt: 1 }}
                    data-testid="daily-open-handoff-timeline"
                  >
                    すべての申し送りを確認
                  </Button>
                </Alert>
              )}
            </>
          )}

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
                {formData.data.amActivities.map((activity: string, index: number) => (
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
                {formData.data.pmActivities.map((activity: string, index: number) => (
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
              <InputLabel id="daily-meal-amount-label">食事摂取量</InputLabel>
              <Select
                labelId="daily-meal-amount-label"
                id="daily-meal-amount-select"
                name="mealAmount"
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

          {/* 問題行動 - 申し送りからの自動提案バナー */}
          {formData.personId &&
            formData.date &&
            !loadingHandoffs &&
            !handoffError &&
            problemSuggestion &&
            !problemSuggestionApplied &&
            isProblemBehaviorEmpty(formData.data.problemBehavior) && (
              <Alert
                severity="info"
                sx={{ p: 2 }}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    💡 申し送りの内容から、問題行動の候補があります
                  </Typography>
                  <Typography variant="body2">
                    必要であれば「提案を反映」を押すと、自傷・暴力・大声・異食などのチェックを
                    自動でオンにします。不要な項目は後から外すことができます。
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {problemSuggestion.selfHarm && <Chip label="自傷（候補）" size="small" />}
                    {problemSuggestion.violence && <Chip label="暴力（候補）" size="small" />}
                    {problemSuggestion.loudVoice && <Chip label="大声（候補）" size="small" />}
                    {problemSuggestion.pica && <Chip label="異食（候補）" size="small" />}
                    {problemSuggestion.other && (
                      <Chip label="その他（候補）" size="small" />
                    )}
                  </Stack>
                  <Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={applyProblemBehaviorSuggestion}
                    >
                      提案を反映
                    </Button>
                  </Box>
                </Stack>
              </Alert>
            )}

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
                    name="seizureSeverity"
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

            {/* Phase 9: 申し送り連携の案内表示 */}
            {!record && !loadingHandoffs && handoffCount > 0 && (
              <Alert
                severity="info"
                icon={<InfoOutlinedIcon />}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">
                  重要度「重要」の申し送りが {handoffCount} 件見つかりました。
                  特記事項に自動で下書きしていますので、不要な行は削除してご利用ください。
                </Typography>
              </Alert>
            )}

            {/* Phase 9: 申し送り取得エラー時の表示 */}
            {!record && handoffError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  申し送り情報の取得に失敗しました: {handoffError}
                </Typography>
              </Alert>
            )}

            <TextField
              fullWidth
              label="特記事項"
              value={formData.data.specialNotes || ''}
              onChange={(e) => handleDataChange('specialNotes', e.target.value)}
              placeholder="その他の重要な情報や申し送り事項"
              multiline
              rows={6}
              helperText={
                !record && handoffCount > 0
                  ? `申し送りから自動転記: ${handoffCount}件`
                  : "その他の重要な情報や申し送り事項を記録してください"
              }
            />
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions
        data-testid="daily-record-form-actions"
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          zIndex: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          <Button
            onClick={handleClose}
            data-testid="cancel-button"
            variant="outlined"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            size="large"
            fullWidth
            sx={{ minHeight: 48 }}
            data-testid="save-button"
            disabled={!isFormValid}
          >
            {record ? '更新' : '保存'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
