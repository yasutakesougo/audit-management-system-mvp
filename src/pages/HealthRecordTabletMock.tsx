import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScaleRoundedIcon from '@mui/icons-material/ScaleRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import {
    Alert,
    AppBar,
    Avatar,
    Backdrop,
    Box,
    Button,
    Card,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Fade,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    MenuItem,
    Modal,
    Paper,
    Select,
    Snackbar,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const COLORS = {
  bg: '#F7F9FC',
  primary: '#00695C',
  accent: '#1976D2',
  warn: '#F57C00',
  danger: '#D32F2F',
  success: '#388E3C',
};

const today = new Date();
const dayOfWeek = today.getDay();
const getCurrentWeightGroup = () => {
  if ([1, 4].includes(dayOfWeek)) return 'A';
  if ([2, 5].includes(dayOfWeek)) return 'B';
  return null;
};
const currentWeightGroup = getCurrentWeightGroup();

const initialUsers = [
  {
    id: 1,
    name: '山田 太郎',
    initial: '山',
    requires: { bp: true, epilepsy: true, weightGroup: 'A' },
    meds: {
      regular: [{ id: 101, name: 'アムロジピン錠5mg', timing: '昼食後' }],
      reserve: [{ id: 201, name: 'ジアゼパム坐剤6mg', stock: 5, indication: 'てんかん重積時' }],
    },
    todayStatus: 'pending',
  },
  {
    id: 2,
    name: '鈴木 花子',
    initial: '鈴',
    requires: { bp: false, epilepsy: false, weightGroup: 'B' },
    meds: { regular: [], reserve: [] },
    todayStatus: 'completed',
  },
  {
    id: 3,
    name: '佐藤 一郎',
    initial: '佐',
    requires: { bp: true, epilepsy: true, weightGroup: 'A' },
    meds: {
      regular: [],
      reserve: [{ id: 202, name: 'ロキソプロフェン錠60mg', stock: 2, indication: '頭痛・発熱時' }],
    },
    todayStatus: 'pending',
  },
  {
    id: 4,
    name: '田中 よし子',
    initial: '田',
    requires: { bp: false, epilepsy: false, weightGroup: 'B' },
    meds: { regular: [], reserve: [] },
    todayStatus: 'pending',
  },
];

const navTabs = [
  { label: 'ダッシュボード', icon: <HomeRoundedIcon />, value: 'home' },
  { label: '健康観察記録', icon: <MedicalServicesRoundedIcon />, value: 'health' },
  { label: '服薬・在庫管理', icon: <MedicationRoundedIcon />, value: 'medication' },
  { label: '記録一覧', icon: <ListAltRoundedIcon />, value: 'log' },
];

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
};

type User = (typeof initialUsers)[number];

type VitalField = 'temp' | 'weight' | 'bpUp' | 'bpDown';

type VitalsRecord = {
  temp: number | null;
  weight: number | null;
  bpUp: number | null;
  bpDown: number | null;
  memo: string;
};

const createEmptyVitals = (): VitalsRecord => ({
  temp: null,
  weight: null,
  bpUp: null,
  bpDown: null,
  memo: '',
});

const createInitialVitalsMap = (): Record<number, VitalsRecord> =>
  initialUsers.reduce<Record<number, VitalsRecord>>((acc, user) => {
    acc[user.id] = createEmptyVitals();
    return acc;
  }, {});

type PrescriptionImage = {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
};

const MAX_PRESCRIPTION_IMAGES = 5;
const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const createInitialPrescriptionImagesMap = (): Record<number, PrescriptionImage[]> =>
  initialUsers.reduce<Record<number, PrescriptionImage[]>>((acc, user) => {
    acc[user.id] = [];
    return acc;
  }, {});

const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const NumericKeypad: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: (value: number | null) => void;
  initialValue: number | null;
  title: string;
}> = ({ open, onClose, onConfirm, initialValue, title }) => {
  const [value, setValue] = useState(String(initialValue ?? ''));

  useEffect(() => {
    if (open) {
      setValue(String(initialValue ?? ''));
    }
  }, [initialValue, open]);

  const handleInput = (digit: string) => {
    if (digit === '.' && value.includes('.')) return;
    if (value.length >= 6) return;
    if (value === '0' && digit !== '.') {
      setValue(digit);
    } else {
      setValue(prev => prev + digit);
    }
  };

  const handleBackspace = () => setValue(prev => prev.slice(0, -1));

  const handleConfirm = () => {
    if (value) {
      const numValue = Number(value);
      if (!Number.isNaN(numValue)) {
        onConfirm(numValue);
        onClose();
        return;
      }
    }
    onConfirm(null);
    onClose();
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'C'];

  return (
    <Modal open={open} onClose={onClose} closeAfterTransition BackdropComponent={Backdrop}>
      <Fade in={open}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 350,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 3,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            {title}
          </Typography>
          <TextField
            value={value}
            fullWidth
            variant="outlined"
            inputProps={{ style: { fontSize: 32, textAlign: 'right' } }}
            sx={{ mb: 2 }}
            InputProps={{ readOnly: true }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {keys.map(key => (
              <Button
                key={key}
                variant="outlined"
                sx={{ height: 70, fontSize: '1.8rem' }}
                onClick={() => {
                  if (key === 'C') handleBackspace();
                  else handleInput(key);
                }}
                color={key === 'C' ? 'error' : 'primary'}
              >
                {key}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 2 }}>
            <Button variant="outlined" fullWidth onClick={onClose} size="large">
              キャンセル
            </Button>
            <Button variant="contained" color="primary" fullWidth onClick={handleConfirm} size="large">
              確定
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

const SeizureRecordDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  user: User;
  showSnackbar: (message: string, severity?: SnackbarState['severity']) => void;
}> = ({ open, onClose, user, showSnackbar }) => {
  const [seizureType, setSeizureType] = useState('');
  const [duration, setDuration] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const [memo, setMemo] = useState('');
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [actions, setActions] = useState({ positioning: false, oxygen: false, medication: false });

  const seizureTypes = ['強直間代発作 (大発作)', '欠神発作 (小発作)', 'ミオクロニー発作', '脱力発作', 'その他'];

  const toggleTimer = () => {
    if (isTiming) {
      setIsTiming(false);
    } else {
      setTimerStart(new Date());
      setIsTiming(true);
      setDuration(0);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTiming && timerStart) {
      interval = setInterval(() => {
        const elapsed = Math.round((new Date().getTime() - timerStart.getTime()) / 1000);
        setDuration(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTiming, timerStart]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const resetForm = () => {
    setSeizureType('');
    setDuration(0);
    setIsTiming(false);
    setMemo('');
    setTimerStart(null);
    setActions({ positioning: false, oxygen: false, medication: false });
  };

  const handleClose = () => {
    if (isTiming && !window.confirm('計測中です。記録を破棄して閉じますか？')) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSave = () => {
    if (!seizureType || duration === 0) {
      showSnackbar('発作種別と持続時間は必須です。', 'error');
      return;
    }
    showSnackbar(`${user.name}さんの発作記録を保存しました。`, 'success');
    if (actions.medication) {
      showSnackbar('予備薬の使用が記録されました。在庫管理画面で確認してください。（※デモ機能）', 'info');
    }
    resetForm();
    onClose();
  };

  const handleActionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setActions(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: COLORS.danger, color: 'white' }}>
        <BoltRoundedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        てんかん発作記録 ({user.name} 様)
      </DialogTitle>
      <DialogContent sx={{ pt: 4 }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
          }}
        >
          <Box>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>発作の種別</InputLabel>
              <Select value={seizureType} label="発作の種別" onChange={event => setSeizureType(event.target.value)}>
                {seizureTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="h6" gutterBottom>
              対応内容チェックリスト
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <FormControlLabel
                control={<Checkbox checked={actions.positioning} onChange={handleActionChange} name="positioning" />}
                label="安全な体位への変換（側臥位など）"
              />
              <FormControlLabel
                control={<Checkbox checked={actions.oxygen} onChange={handleActionChange} name="oxygen" />}
                label="酸素投与"
              />
              <FormControlLabel
                control={<Checkbox checked={actions.medication} onChange={handleActionChange} name="medication" />}
                label="予備薬（頓服）の使用"
              />
            </Box>
            <TextField
              label="状況・対応メモ（意識レベル、呼吸状態など）"
              multiline
              rows={4}
              value={memo}
              onChange={event => setMemo(event.target.value)}
              fullWidth
            />
          </Box>
          <Box>
            <Card variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: COLORS.bg }}>
              <Typography variant="h6">
                <TimerRoundedIcon sx={{ mr: 1 }} />
                持続時間計測
              </Typography>
              <Typography variant="h1" sx={{ my: 4, fontFamily: 'monospace' }}>
                {formatDuration(duration)}
              </Typography>
              <Button
                variant="contained"
                onClick={toggleTimer}
                color={isTiming ? 'error' : 'success'}
                size="large"
                fullWidth
                sx={{ py: 2 }}
              >
                {isTiming ? '停止して確定' : '計測開始'}
              </Button>
            </Card>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} variant="outlined" size="large">
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" size="large">
          記録を保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const HealthCheckTab: React.FC<{
  user: User;
  vitals: VitalsRecord;
  onOpenKeypad: (field: VitalField, label: string) => void;
  onMemoChange: (memo: string) => void;
  showSnackbar: (message: string, severity?: SnackbarState['severity']) => void;
  updateStatus: (userId: number, status: User['todayStatus']) => void;
  onNextUser: () => void;
}> = ({ user, vitals, onOpenKeypad, onMemoChange, showSnackbar, updateStatus, onNextUser }) => {
  const [seizureDialogOpen, setSeizureDialogOpen] = useState(false);

  const isWeightMeasurementDay = user.requires.weightGroup === currentWeightGroup;
  const requiresBP = user.requires.bp;

  const isInputComplete = useMemo(() => {
    if (vitals.temp === null) return false;
    if (isWeightMeasurementDay && vitals.weight === null) return false;
    if (requiresBP && (vitals.bpUp === null || vitals.bpDown === null)) return false;
    return true;
  }, [vitals, isWeightMeasurementDay, requiresBP]);

  const openFieldKeypad = (field: VitalField, label: string) => {
    if (isWeightMeasurementDay || (field !== 'weight')) {
      onOpenKeypad(field, label);
    }
  };

  const handleSave = (andNext = false) => {
    if (!isInputComplete) {
      showSnackbar('必須項目が入力されていません。要測定の項目を確認してください。', 'warning');
      return;
    }
    updateStatus(user.id, 'completed');
    showSnackbar(`${user.name}さんの健康観察記録を保存しました。`, 'success');
    if (andNext) {
      onNextUser();
    }
  };

  const VitalCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    unit: string;
    field: VitalField | VitalField[];
    required: boolean;
    disabled?: boolean;
  }> = ({ title, icon, unit, field, required, disabled }) => {
    const fields: VitalField[] = Array.isArray(field) ? field : [field];
    const effectiveDisabled = disabled && !required;
    const isFilled = fields.every(f => vitals[f] !== null && vitals[f] !== undefined);

    return (
      <Card
        sx={{
          p: 3,
          height: '100%',
          opacity: effectiveDisabled ? 0.5 : 1,
          border: required ? `2px solid ${COLORS.accent}` : '1px solid #e0e0e0',
          bgcolor: required ? `${COLORS.accent}10` : 'background.paper',
        }}
      >
        <Box display="flex" alignItems="center" mb={3}>
          <Avatar sx={{ bgcolor: COLORS.primary, mr: 2 }}>{icon}</Avatar>
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
          {required && (
            <Chip label={isFilled ? '入力済' : '要測定'} color={isFilled ? 'success' : 'primary'} size="small" sx={{ ml: 'auto' }} />
          )}
        </Box>
        <Box display="flex" alignItems="baseline" justifyContent="center" gap={1}>
          {fields.map((f, index) => (
            <React.Fragment key={f}>
              {index > 0 && <Typography variant="h3">/</Typography>}
              <Tooltip title={effectiveDisabled ? '測定不要' : 'タップして入力'}>
                <Typography
                  variant="h3"
                  onClick={
                    effectiveDisabled
                      ? undefined
                      : () => {
                          const label =
                            fields.length > 1
                              ? `${title}${f === 'bpUp' ? ' (上)' : ' (下)'}`
                              : title;
                          openFieldKeypad(f as VitalField, label);
                        }
                  }
                  sx={{
                    cursor: effectiveDisabled ? 'default' : 'pointer',
                    borderBottom: '2px dashed #ccc',
                    px: 1,
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  {(() => {
                    const value = vitals[f];
                    if (typeof value === 'number') {
                      if (f === 'bpUp' || f === 'bpDown') {
                        return value.toFixed(0);
                      }
                      return value.toFixed(1);
                    }
                    return '-';
                  })()}
                </Typography>
              </Tooltip>
            </React.Fragment>
          ))}
          <Typography variant="h6" ml={1}>
            {unit}
          </Typography>
        </Box>
      </Card>
    );
  };

  return (
    <Box>
      {user.requires.epilepsy && (
        <SeizureRecordDialog
          open={seizureDialogOpen}
          onClose={() => setSeizureDialogOpen(false)}
          user={user}
          showSnackbar={showSnackbar}
        />
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" fontWeight="bold">
          {user.name} 様 健康観察記録
        </Typography>
        {user.requires.epilepsy && (
          <Button
            variant="contained"
            color="error"
            startIcon={<BoltRoundedIcon />}
            onClick={() => setSeizureDialogOpen(true)}
            size="large"
          >
            発作記録を入力
          </Button>
        )}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 4,
          mb: 4,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}
      >
        <Box>
          <VitalCard title="体温" icon={<ThermostatRoundedIcon />} unit="℃" field="temp" required />
        </Box>
        <Box>
          <VitalCard
            title="体重"
            icon={<ScaleRoundedIcon />}
            unit="kg"
            field="weight"
            required={isWeightMeasurementDay}
            disabled={!isWeightMeasurementDay}
          />
        </Box>
        <Box>
          <VitalCard
            title="血圧"
            icon={<MonitorHeartRoundedIcon />}
            unit="mmHg"
            field={['bpUp', 'bpDown']}
            required={requiresBP}
            disabled={!requiresBP}
          />
        </Box>
      </Box>
      <Card sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          特記事項・様子
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="日中活動の様子、食欲、気になる点など..."
          value={vitals.memo}
          onChange={event => onMemoChange(event.target.value)}
          InputProps={{ style: { fontSize: '1.2rem' } }}
        />
      </Card>
      <Box display="flex" justifyContent="flex-end" gap={3}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => handleSave(false)}
          disabled={!isInputComplete}
          startIcon={<SaveRoundedIcon />}
          sx={{ px: 6, py: 2 }}
        >
          保存
        </Button>
        <Button
          variant="contained"
          color="success"
          size="large"
          onClick={() => handleSave(true)}
          disabled={!isInputComplete}
          endIcon={<ArrowForwardIosRoundedIcon />}
          sx={{ px: 6, py: 2 }}
        >
          保存して次へ
        </Button>
      </Box>
    </Box>
  );
};

const MedicationTab: React.FC<{
  user: User;
  prescriptionImages: PrescriptionImage[];
  onUploadImages: (files: File[]) => void;
  onRemoveImage: (imageId: string) => void;
  showSnackbar: (message: string, severity?: SnackbarState['severity']) => void;
}> = ({ user, prescriptionImages, onUploadImages, onRemoveImage, showSnackbar }) => {
  const [regularChecks, setRegularChecks] = useState<Record<number, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRegularChecks({});
  }, [user]);

  const handleRegularCheck = (medId: number, checked: boolean) => {
    setRegularChecks(prev => ({ ...prev, [medId]: checked }));
  };

  const handleSaveRegular = () => {
    showSnackbar(`${user.name}さんの定期薬服薬記録を保存しました。`, 'success');
  };

  const handleUseReserve = (med: (typeof user.meds.reserve)[number]) => {
    if (med.stock <= 0) {
      showSnackbar('在庫がありません。', 'error');
      return;
    }
    if (window.confirm(`${med.name}を1つ使用しますか？在庫が減少します。（デモ動作）`)) {
      showSnackbar(`${med.name}を使用しました。在庫が更新されました。（デモ動作）`, 'info');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      onUploadImages(files);
    }
    event.target.value = '';
  };

  const reachedImageLimit = prescriptionImages.length >= MAX_PRESCRIPTION_IMAGES;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={4}>
        {user.name} 様 服薬・在庫管理
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 4,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        <Box>
          <Card sx={{ p: 4, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" mb={3}>
              <MedicationRoundedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              定期薬チェックリスト
            </Typography>
            {user.meds.regular.length > 0 ? (
              <>
                <List>
                  {user.meds.regular.map(med => (
                    <ListItem key={med.id} divider sx={{ py: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            sx={{ transform: 'scale(1.5)', mr: 2 }}
                            checked={Boolean(regularChecks[med.id])}
                            onChange={event => handleRegularCheck(med.id, event.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="h6">{med.name}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              タイミング: {med.timing}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                <Box mt={3} display="flex" justifyContent="flex-end">
                  <Button variant="contained" color="success" onClick={handleSaveRegular} size="large">
                    服薬記録を保存
                  </Button>
                </Box>
              </>
            ) : (
              <Typography color="textSecondary">本日の定期薬はありません。</Typography>
            )}
          </Card>
        </Box>
        <Box>
          <Card sx={{ p: 4, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" mb={3}>
              <Inventory2RoundedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              予備薬（頓服）在庫管理
            </Typography>
            {user.meds.reserve.length > 0 ? (
              <List>
                {user.meds.reserve.map(med => (
                  <ListItem
                    key={med.id}
                    divider
                    sx={{ py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Box>
                      <Typography variant="h6">{med.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        適応: {med.indication}
                      </Typography>
                      <Typography variant="h6" mt={1}>
                        現在在庫数:
                        <strong
                          style={{
                            fontSize: '1.8rem',
                            marginLeft: 8,
                            color: med.stock <= 3 ? COLORS.danger : 'inherit',
                          }}
                        >
                          {med.stock}
                        </strong>
                      </Typography>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1}>
                      <Button variant="contained" color="warning" onClick={() => handleUseReserve(med)} disabled={med.stock <= 0}>
                        使用を記録 (-1)
                      </Button>
                      {med.stock <= 3 && <Chip label="残数僅か" color="error" />}
                    </Box>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">管理している予備薬はありません。</Typography>
            )}
          </Card>
        </Box>
      </Box>
      <Card sx={{ mt: 4, p: 4 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              処方箋画像管理
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternateRoundedIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={reachedImageLimit}
              >
                画像を追加
              </Button>
              <Typography variant="body2" color="text.secondary">
                {prescriptionImages.length}/{MAX_PRESCRIPTION_IMAGES} 枚（5MB以下の画像）
              </Typography>
            </Stack>
          </Stack>
          {prescriptionImages.length > 0 ? (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              }}
            >
              {prescriptionImages.map(image => (
                <Paper key={image.id} variant="outlined" sx={{ p: 2 }}>
                  <Box
                    component="img"
                    src={image.dataUrl}
                    alt={image.name}
                    sx={{ width: '100%', borderRadius: 1, maxHeight: 220, objectFit: 'cover' }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mt={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Tooltip title={image.name}>
                        <Typography variant="body2" noWrap>
                          {image.name}
                        </Typography>
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(image.uploadedAt).toLocaleString('ja-JP')}
                      </Typography>
                    </Box>
                    <IconButton size="small" aria-label="画像を削除" onClick={() => onRemoveImage(image.id)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              登録された処方箋画像はありません。
            </Typography>
          )}
        </Stack>
      </Card>
    </Box>
  );
};

const HomeDashboard: React.FC<{
  users: User[];
  setTab: React.Dispatch<React.SetStateAction<string>>;
  setSelectedUserId: React.Dispatch<React.SetStateAction<number>>;
  vitalsByUser: Record<number, VitalsRecord>;
  onQuickInput: (userId: number, field: VitalField, label: string) => void;
}> = ({ users, setTab, setSelectedUserId, vitalsByUser, onQuickInput }) => {
  const pendingUsers = users.filter(u => u.todayStatus === 'pending');

  const handleActionClick = (user: User) => {
    setSelectedUserId(user.id);
    setTab('health');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        本日の実施状況ダッシュボード
      </Typography>
      {currentWeightGroup && (
        <Alert severity="info" icon={<ScaleRoundedIcon fontSize="inherit" />} sx={{ mb: 4, fontSize: '1.2rem', p: 3 }}>
          <Typography variant="h6">本日のスケジュール通知</Typography>
          本日は <strong>{currentWeightGroup}グループ</strong> の体重測定日です。対象者の測定漏れがないか確認してください。
        </Alert>
      )}
      <Card sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          健康観察 未完了リスト ({pendingUsers.length}名)
        </Typography>
        {pendingUsers.length > 0 ? (
          <List>
            {pendingUsers.map((user, index) => {
              const isWeightDay = user.requires.weightGroup === currentWeightGroup;
              const userVitals = vitalsByUser[user.id] ?? createEmptyVitals();
              const tempLabel =
                typeof userVitals.temp === 'number' ? `${userVitals.temp.toFixed(1)}℃` : '未入力';
              const weightLabel =
                typeof userVitals.weight === 'number' ? `${userVitals.weight.toFixed(1)}kg` : '未入力';
              return (
                <React.Fragment key={user.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleActionClick(user)}
                      sx={{
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ width: 56, height: 56, fontSize: '1.5rem' }}>{user.initial}</Avatar>
                      </ListItemAvatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6">{user.name} 様</Typography>
                        <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={event => {
                              event.stopPropagation();
                              onQuickInput(user.id, 'temp', `${user.name}さん 体温入力`);
                            }}
                          >
                            体温: {tempLabel}
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={!isWeightDay}
                            onClick={event => {
                              event.stopPropagation();
                              onQuickInput(user.id, 'weight', `${user.name}さん 体重入力`);
                            }}
                          >
                            体重: {isWeightDay ? weightLabel : '非対象'}
                          </Button>
                        </Box>
                      </Box>
                      <Box display="flex" gap={1} mr={2}>
                        {isWeightDay && <Chip label="体重測定日" color="primary" />}
                        {user.requires.bp && <Chip label="血圧対象" color="secondary" />}
                        {user.requires.epilepsy && <Chip label="てんかん歴" color="warning" />}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < pendingUsers.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        ) : (
          <Alert severity="success" sx={{ fontSize: '1.2rem' }}>
            本日の健康観察は全員完了しました。
          </Alert>
        )}
      </Card>
    </Box>
  );
};

const RecordLog: React.FC = () => {
  const rows = [
    {
      id: 1,
      date: '2025/10/17 10:00',
      user: '山田 太郎',
      category: '健康観察',
      details: '体温:36.5℃, 血圧:120/78, 体重:65.2kg',
      staff: '鈴木',
    },
    {
      id: 2,
      date: '2025/10/17 10:15',
      user: '山田 太郎',
      category: '発作記録',
      details: '強直間代発作 (01:30). 対応: 体位変換, 予備薬使用.',
      staff: '鈴木',
    },
    {
      id: 3,
      date: '2025/10/17 10:16',
      user: '山田 太郎',
      category: '予備薬使用',
      details: 'ジアゼパム坐剤6mg 使用 (在庫5→4)',
      staff: '鈴木',
    },
    {
      id: 4,
      date: '2025/10/17 12:30',
      user: '山田 太郎',
      category: '服薬（定期）',
      details: 'アムロジピン錠5mg 実施済み',
      staff: '佐藤',
    },
    {
      id: 5,
      date: '2025/10/17 10:05',
      user: '鈴木 花子',
      category: '健康観察',
      details: '体温:36.8℃, 体重:55.1kg',
      staff: '鈴木',
    },
  ];

  const columns: GridColDef[] = [
    { field: 'date', headerName: '日時', width: 180 },
    { field: 'user', headerName: '利用者名', width: 150 },
    {
      field: 'category',
      headerName: '種別',
      width: 150,
      renderCell: params => {
        let color: 'default' | 'primary' | 'warning' | 'error' = 'default';
        if (params.value === '発作記録') color = 'error';
        if (params.value === '予備薬使用') color = 'warning';
        if (params.value === '健康観察') color = 'primary';
        return <Chip label={params.value} color={color} variant="outlined" />;
      },
    },
    { field: 'details', headerName: '記録詳細', flex: 1, minWidth: 400 },
    { field: 'staff', headerName: '記録者', width: 120 },
  ];

  return (
    <Paper sx={{ height: 700, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[15, 30]}
        initialState={{ pagination: { paginationModel: { pageSize: 15 } } }}
        sx={{ fontSize: '1rem' }}
      />
    </Paper>
  );
};

export default function HealthRecordTabletMock() {
  const [tab, setTab] = useState('home');
  const [users, setUsers] = useState(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0].id);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [vitalsByUser, setVitalsByUser] = useState<Record<number, VitalsRecord>>(() => createInitialVitalsMap());
  const [prescriptionImagesByUser, setPrescriptionImagesByUser] = useState<Record<number, PrescriptionImage[]>>(
    () => createInitialPrescriptionImagesMap(),
  );
  const [keypadState, setKeypadState] = useState<{ userId: number; field: VitalField; label: string } | null>(null);

  const selectedUser = users.find(user => user.id === selectedUserId) ?? initialUsers[0];

  const handleTabChange = (_event: React.SyntheticEvent, value: string) => setTab(value);

  const showSnackbar = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleVitalsChange = useCallback((userId: number, field: VitalField, value: number | null) => {
    setVitalsByUser(prev => {
      const current = prev[userId] ?? createEmptyVitals();
      return {
        ...prev,
        [userId]: { ...current, [field]: value },
      };
    });
  }, []);

  const handleMemoChange = useCallback((userId: number, memo: string) => {
    setVitalsByUser(prev => {
      const current = prev[userId] ?? createEmptyVitals();
      return {
        ...prev,
        [userId]: { ...current, memo },
      };
    });
  }, []);

  const handleOpenKeypad = useCallback((userId: number, field: VitalField, label: string) => {
    setKeypadState({ userId, field, label });
  }, []);

  const handleKeypadConfirm = (value: number | null) => {
    if (keypadState) {
      handleVitalsChange(keypadState.userId, keypadState.field, value);
    }
    setKeypadState(null);
  };

  const handleUploadPrescriptionImages = useCallback(
    async (userId: number, files: File[]) => {
      if (!files.length) {
        return;
      }
      const existing = prescriptionImagesByUser[userId] ?? [];
      const remainingSlots = MAX_PRESCRIPTION_IMAGES - existing.length;
      if (remainingSlots <= 0) {
        showSnackbar('これ以上画像を追加できません（最大5枚）', 'info');
        return;
      }
      const accepted: File[] = [];
      let oversizedCount = 0;
      files.forEach(file => {
        if (file.size > MAX_IMAGE_FILE_SIZE) {
          oversizedCount += 1;
          return;
        }
        accepted.push(file);
      });
      if (oversizedCount > 0) {
        showSnackbar('5MBを超える画像は追加できませんでした', 'warning');
      }
      if (!accepted.length) {
        return;
      }
      const limited = accepted.slice(0, remainingSlots);
      if (accepted.length > remainingSlots) {
        showSnackbar(`最大${MAX_PRESCRIPTION_IMAGES}枚までです。${accepted.length - remainingSlots}枚は追加できませんでした`, 'info');
      }
      try {
        const newImages = await Promise.all(
          limited.map(async file => {
            const dataUrl = await readFileAsDataURL(file);
            return {
              id: `rx-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              size: file.size,
              dataUrl,
              uploadedAt: new Date().toISOString(),
            } as PrescriptionImage;
          }),
        );
        setPrescriptionImagesByUser(prev => {
          const current = prev[userId] ?? [];
          return {
            ...prev,
            [userId]: [...current, ...newImages],
          };
        });
        showSnackbar(`${newImages.length}件の処方箋画像を追加しました`, 'success');
      } catch (error) {
        console.error('Failed to read prescription images', error);
        showSnackbar('画像の読み込みに失敗しました', 'error');
      }
    },
    [prescriptionImagesByUser, showSnackbar],
  );

  const handleRemovePrescriptionImage = useCallback(
    (userId: number, imageId: string) => {
      let removed = false;
      setPrescriptionImagesByUser(prev => {
        const current = prev[userId] ?? [];
        const next = current.filter(image => image.id !== imageId);
        if (next.length === current.length) {
          return prev;
        }
        removed = true;
        return { ...prev, [userId]: next };
      });
      if (removed) {
        showSnackbar('処方箋画像を削除しました', 'info');
      }
    },
    [showSnackbar],
  );

  const updateStatus = useCallback((userId: number, status: User['todayStatus']) => {
    setUsers(prev =>
      prev.map(user => {
        if (user.id === userId) {
          return { ...user, todayStatus: status };
        }
        return user;
      }),
    );
  }, []);

  const handleNextUser = useCallback(() => {
    const currentIndex = users.findIndex(user => user.id === selectedUserId);
    if (currentIndex < users.length - 1) {
      setSelectedUserId(users[currentIndex + 1].id);
    } else {
      showSnackbar('最後の利用者です。', 'info');
      setTab('home');
    }
  }, [selectedUserId, users, showSnackbar]);

  const handleUserSelect = (userId: number) => {
    setSelectedUserId(userId);
    if (tab === 'home' || tab === 'log') {
      setTab('health');
    }
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: COLORS.bg, minHeight: '100vh' }}>
      <Paper elevation={3} sx={{ width: 280, flexShrink: 0, height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
        <Box sx={{ p: 3, bgcolor: COLORS.primary, color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">
            利用者一覧
          </Typography>
          <Typography variant="body2">
            {today.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Typography>
        </Box>
        <List>
          {users.map(user => {
            const statusIcon =
              user.todayStatus === 'completed' ? (
                <CheckCircleOutlineRoundedIcon color="success" />
              ) : (
                <PendingActionsRoundedIcon color="action" />
              );
            const userVitals = vitalsByUser[user.id] ?? createEmptyVitals();
            const isWeightDay = user.requires.weightGroup === currentWeightGroup;
            const tempLabel =
              typeof userVitals.temp === 'number' ? `${userVitals.temp.toFixed(1)}℃` : '未入力';
            const weightLabel =
              typeof userVitals.weight === 'number' ? `${userVitals.weight.toFixed(1)}kg` : '未入力';
            return (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  onClick={() => handleUserSelect(user.id)}
                  selected={selectedUserId === user.id}
                  sx={{
                    py: 2,
                    '&.Mui-selected': {
                      borderRight: `4px solid ${COLORS.primary}`,
                      bgcolor: `${COLORS.primary}10`,
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: COLORS.primary }}>{user.initial}</Avatar>
                  </ListItemAvatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {user.name}
                    </Typography>
                    <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={event => {
                          event.stopPropagation();
                          handleOpenKeypad(user.id, 'temp', `${user.name}さん 体温入力`);
                        }}
                      >
                        体温: {tempLabel}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!isWeightDay}
                        onClick={event => {
                          event.stopPropagation();
                          handleOpenKeypad(user.id, 'weight', `${user.name}さん 体重入力`);
                        }}
                      >
                        体重: {isWeightDay ? weightLabel : '非対象'}
                      </Button>
                    </Box>
                  </Box>
                  <Tooltip title={user.todayStatus === 'completed' ? '本日の入力完了' : '未入力あり'}>
                    {statusIcon}
                  </Tooltip>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Paper>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" color="default" elevation={1}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            {navTabs.map(t => (
              <Tab key={t.value} icon={t.icon} label={t.label} value={t.value} sx={{ py: 3, fontSize: '1.1rem', minWidth: 200 }} iconPosition="start" />
            ))}
          </Tabs>
        </AppBar>
        <Box sx={{ p: 4 }}>
          {tab === 'home' && (
            <HomeDashboard
              users={users}
              setTab={setTab}
              setSelectedUserId={setSelectedUserId}
              vitalsByUser={vitalsByUser}
              onQuickInput={handleOpenKeypad}
            />
          )}
          {tab === 'health' && (
            <HealthCheckTab
              user={selectedUser}
              vitals={vitalsByUser[selectedUser.id] ?? createEmptyVitals()}
              onOpenKeypad={(field, label) => handleOpenKeypad(selectedUser.id, field, label)}
              onMemoChange={value => handleMemoChange(selectedUser.id, value)}
              showSnackbar={showSnackbar}
              updateStatus={updateStatus}
              onNextUser={handleNextUser}
            />
          )}
          {tab === 'medication' && (
            <MedicationTab
              user={selectedUser}
              prescriptionImages={prescriptionImagesByUser[selectedUser.id] ?? []}
              onUploadImages={files => handleUploadPrescriptionImages(selectedUser.id, files)}
              onRemoveImage={imageId => handleRemovePrescriptionImage(selectedUser.id, imageId)}
              showSnackbar={showSnackbar}
            />
          )}
          {tab === 'log' && <RecordLog />}
        </Box>
      </Box>
      <NumericKeypad
        open={Boolean(keypadState)}
        onClose={() => setKeypadState(null)}
        onConfirm={handleKeypadConfirm}
        initialValue={keypadState ? vitalsByUser[keypadState.userId][keypadState.field] ?? null : null}
        title={keypadState?.label ?? '数値を入力'}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled" sx={{ width: '100%', fontSize: '1.1rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
