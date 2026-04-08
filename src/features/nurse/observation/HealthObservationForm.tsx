import { usePrefersReducedMotion } from '@/lib/a11y/usePrefersReducedMotion';
import { notify } from '@/lib/notice';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsers } from '@/features/users/useUsers';
import { compareUsersByJapaneseOrder } from '@/lib/i18n/japaneseCollator';
import TagPills from '../components/TagPills';
import { useToast } from '../components/ToastContext';
import VitalCard from '../components/VitalCard';
import { thresholds } from '../constants/thresholds';
import { buildIdempotencyKey, queue, QUEUE_MAX } from '../state/offlineQueue';

const TAGS = ['顔色良好', 'やや眠気', '食欲低下', '咳あり', '便秘傾向'];

const defaultVitals = { temp: 36.6, pulse: 76, sys: 118, dia: 72, spo2: 97, weight: 58.2 };

type WeightBaselineEntry = { value: number; date: string };
type WeightBaselineMap = Record<string, WeightBaselineEntry>;

const WEIGHT_BASELINE_STORAGE_KEY = 'nurse.obs.weight.baseline';

const loadWeightBaselines = (): WeightBaselineMap => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(WEIGHT_BASELINE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return Object.entries(parsed as Record<string, unknown>).reduce<WeightBaselineMap>((acc, [key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as Record<string, unknown>).value === 'number' &&
        Number.isFinite((value as Record<string, unknown>).value) &&
        typeof (value as Record<string, unknown>).date === 'string'
      ) {
        acc[key] = {
          value: (value as { value: number }).value,
          date: (value as { date: string }).date,
        };
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const persistWeightBaselines = (map: WeightBaselineMap) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEIGHT_BASELINE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures for baselines.
  }
};

type HealthObservationFormProps = {
  autoFocusEmpty?: boolean;
  selectedUser?: string;
  onUserChange?: (user: string) => void;
  selectedDate?: string;
};

const HealthObservationForm: React.FC<HealthObservationFormProps> = ({
  autoFocusEmpty = false,
  selectedUser,
  onUserChange,
  selectedDate,
}) => {
  const toast = useToast();
  const { data: users, status: userStatus } = useUsers({ selectMode: 'core' });
  const isLoadingUsers = userStatus === 'loading' || userStatus === 'idle';
  const defaultUser = useMemo(() => {
    if (selectedUser) {
      return selectedUser;
    }
    const firstActive = users.find((u) => u.IsActive !== false);
    return firstActive?.UserID ?? firstActive?.Id?.toString() ?? users[0]?.UserID ?? users[0]?.Id?.toString() ?? '';
  }, [selectedUser, users]);

  const [user, setUser] = useState<string>(defaultUser);
  const selectedUserName = useMemo(() => {
    return users.find((u) => (u.UserID ?? u.Id?.toString()) === user)?.FullName ?? '';
  }, [user, users]);
  const [memo, setMemo] = useState('');
  const [isMemoOpen, setMemoOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [vals, setVals] = useState(() => ({ ...defaultVitals }));
  const [weightBaselines, setWeightBaselines] = useState<WeightBaselineMap>(() => loadWeightBaselines());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const tempRef = useRef<HTMLInputElement | null>(null);
  const weightAssistId = useId();

  useEffect(() => {
    if (selectedUser) {
      setUser(selectedUser);
      return;
    }
    if (!user && defaultUser) {
      setUser(defaultUser);
    }
  }, [selectedUser, defaultUser, user]);

  useEffect(() => {
    if (!autoFocusEmpty) return;
    const focus = () => {
      if (tempRef.current && document.activeElement !== tempRef.current) {
        tempRef.current.focus();
        tempRef.current.select?.();
      }
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(focus);
    } else {
      setTimeout(focus, 0);
    }
  }, [autoFocusEmpty]);

  useEffect(() => {
    persistWeightBaselines(weightBaselines);
  }, [weightBaselines]);

  const activeWeightBaseline = user ? weightBaselines[user] : undefined;
  const weightDifference =
    activeWeightBaseline && Number.isFinite(vals.weight)
      ? vals.weight - activeWeightBaseline.value
      : null;
  const weightDeltaAbs = weightDifference != null ? Math.abs(weightDifference) : null;
  const isWeightOutOfRange =
    !Number.isFinite(vals.weight) ||
    vals.weight < thresholds.weight.min ||
    vals.weight > thresholds.weight.max;
  const isWeightDeltaWarn = weightDeltaAbs != null && weightDeltaAbs >= thresholds.weight.deltaWarn;
  const isWeightDeltaDanger = weightDeltaAbs != null && weightDeltaAbs >= thresholds.weight.deltaDanger;
  const isWeightDanger = isWeightOutOfRange || isWeightDeltaDanger;
  const weightCurrentDisplay = Number.isFinite(vals.weight) ? vals.weight.toFixed(1) : String(vals.weight);
  const weightDeltaDisplay =
    weightDifference != null
      ? `${weightDifference >= 0 ? '+' : '-'}${Math.abs(weightDifference).toFixed(1)}kg`
      : '±0.0kg';
  const weightAssistText = activeWeightBaseline
    ? `基準 ${activeWeightBaseline.value.toFixed(1)}kg / ${activeWeightBaseline.date} ・ 前回比 ${weightDeltaDisplay}`
    : '保存すると前回比が表示されます。';
  const weightAssistTone = isWeightDanger ? 'error.main' : isWeightDeltaWarn ? 'warning.main' : 'text.secondary';

  const isDanger = useMemo(
    () => ({
      temp:
        vals.temp >= thresholds.temp.danger ||
        vals.temp < thresholds.temp.min ||
        vals.temp > thresholds.temp.max,
      spo2: vals.spo2 <= thresholds.spo2.danger,
      weight: isWeightDanger,
    }),
    [isWeightDanger, vals],
  );

  const buildConfirmMessage = () => {
    const alerts: string[] = [];
    if (isDanger.spo2) {
      alerts.push(`SpO2 ${vals.spo2}% は危険域（<=${thresholds.spo2.danger}%）です。保存してよいですか？`);
    }
    if (isDanger.temp) {
      alerts.push(`体温 ${vals.temp}℃ が許容外です。確認してください。`);
    }
    if (isWeightOutOfRange) {
      alerts.push(
        `体重 ${weightCurrentDisplay}kg が許容範囲（${thresholds.weight.min}〜${thresholds.weight.max}kg）を外れています。確認してください。`,
      );
    }
    if (activeWeightBaseline && isWeightDeltaWarn) {
      const deltaText = (weightDeltaAbs ?? 0).toFixed(1);
      alerts.push(
        `体重: 前回比 ±${deltaText}kg（基準: ${activeWeightBaseline.value.toFixed(1)}kg / ${activeWeightBaseline.date}）。±${thresholds.weight.deltaWarn.toFixed(1)}kg 超は注意、±${thresholds.weight.deltaDanger.toFixed(1)}kg 超は危険域。`,
      );
    }
    return alerts;
  };

  const resetForm = (nextWeight?: number) => {
    setMemo('');
    setTags([]);
    const weightValue =
      typeof nextWeight === 'number' && Number.isFinite(nextWeight) ? Number(nextWeight.toFixed(1)) : defaultVitals.weight;
    setVals({ ...defaultVitals, weight: weightValue });
  };

  const observationTimestamp = () => {
    if (!selectedDate) {
      return new Date().toISOString();
    }
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const timeFragment = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const candidate = new Date(`${selectedDate}T${timeFragment}`);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
    return now.toISOString();
  };

  const enqueueObservation = () => {
    const at = observationTimestamp();
    const sanitizedWeight = Number.isFinite(vals.weight) ? Number(vals.weight) : undefined;
    const roundedWeight = sanitizedWeight !== undefined ? Number(sanitizedWeight.toFixed(1)) : undefined;
    const vitalsPayload = {
      temp: vals.temp,
      pulse: vals.pulse,
      sys: vals.sys,
      dia: vals.dia,
      spo2: vals.spo2,
      ...(roundedWeight !== undefined ? { weight: roundedWeight } : {}),
    };

    const idempotencyKey = buildIdempotencyKey({ userId: user, type: 'observation', timestampUtc: at });
    const result = queue.add({
      idempotencyKey,
      type: 'observation',
      userId: user,
      vitals: vitalsPayload,
      memo,
      tags,
      timestampUtc: at,
      localTz: 'Asia/Tokyo',
      source: 'observation.form',
      retryCount: 0,
    });

    if (roundedWeight !== undefined && user) {
      const baselineEntry: WeightBaselineEntry = {
        value: roundedWeight,
        date: at.slice(0, 10),
      };
      setWeightBaselines((prev) => ({ ...prev, [user]: baselineEntry }));
    }
    if (result.warned) {
      const severity = result.size >= QUEUE_MAX ? 'warning' : 'info';
      const message =
        severity === 'warning'
          ? `未送信キューが上限に近づいています（${result.size}/${QUEUE_MAX}）。同期してください。`
          : `未送信キュー：${result.size} 件`;
      toast.show(message, severity);
    } else {
      toast.show('観察記録を保存しました。同期キューに追加しました。');
    }
    notify('看護観察記録を同期キューに追加しました。');
    resetForm(roundedWeight);
  };

  const handleSave = (force = false) => {
    if (!user) {
      toast.show('利用者が選択されていません。選択してから保存してください。', 'error');
      return;
    }
    const alerts = buildConfirmMessage();
    if (!force && alerts.length > 0) {
      setConfirmMsg(alerts.join('\n'));
      setConfirmOpen(true);
      return;
    }
    enqueueObservation();
  };

  const userOptions = useMemo(() => {
    const sortedUsers = [...users].sort(compareUsersByJapaneseOrder);

    const options = sortedUsers.map((entry) => ({
      value: entry.UserID ?? entry.Id.toString(),
      label: `${entry.UserID ?? entry.Id} ${entry.FullName}`.trim(),
    }));
    if (user && !options.some((option) => option.value === user)) {
      options.push({ value: user, label: user });
    }
    return options;
  }, [user, users]);

  const memoToggleId = TESTIDS.NURSE_MEMO_TOGGLE;
  const memoPanelId = TESTIDS.NURSE_MEMO_PANEL;
  const memoSummary = memo.trim().split('\n')[0] ?? '';
  const hasMemoContent = memoSummary.length > 0 || tags.length > 0;
  const prefersReducedMotion = usePrefersReducedMotion();
  const collapseTimeout: number | 'auto' = prefersReducedMotion ? 0 : 'auto';

  return (
    <Box data-testid={TESTIDS.NURSE_OBS_PAGE}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{
          mb: 2,
          alignItems: { xs: 'flex-start', md: 'center' },
          flexWrap: { md: 'wrap' },
          rowGap: { xs: 2, md: 1.5 },
        }}
      >
        <TextField
          select
          label="利用者"
          disabled={isLoadingUsers}
          value={user}
          onChange={(event) => {
            const next = event.target.value;
            setUser(next);
            onUserChange?.(next);
          }}
          sx={{
            minWidth: { xs: '100%', md: 220 },
            flex: { md: '1 1 220px' },
          }}
          data-testid={TESTIDS.NURSE_OBS_USER}
          InputProps={{
            startAdornment: isLoadingUsers ? (
              <CircularProgress size={20} sx={{ mr: 1 }} />
            ) : null,
          }}
        >
          <MenuItem value="">利用者を選択</MenuItem>
          {userOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            ml: { xs: 0, md: 'auto' },
            flexWrap: 'wrap',
            rowGap: 1,
            columnGap: 1,
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
          }}
        >
          <Button variant="outlined" size="small">
            前回との差分
          </Button>
          <Button variant="outlined" size="small">
            履歴
          </Button>
        </Stack>
      </Stack>

      <Box data-testid={TESTIDS.NURSE_BP_PANEL} sx={{ maxWidth: { md: 880 }, mx: { md: 'auto' } }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.25, md: 1.5 },
            gridTemplateColumns: {
              xs: 'repeat(auto-fit, minmax(220px, 1fr))',
              md: 'repeat(auto-fit, minmax(240px, 1fr))',
            },
            alignItems: 'stretch',
          }}
        >
          <VitalCard
            label="体温"
            unit="℃"
            value={vals.temp}
            onChange={(value) => setVals((prev) => ({ ...prev, temp: value }))}
            isDanger={isDanger.temp}
            step={0.1}
            inputRef={tempRef}
          />
          <VitalCard
            label="脈拍"
            unit="bpm"
            value={vals.pulse}
            onChange={(value) => setVals((prev) => ({ ...prev, pulse: value }))}
            inputTestId={TESTIDS.NURSE_BP_INPUT_PULSE}
          />
          <VitalCard
            label="血圧(上)"
            unit="mmHg"
            value={vals.sys}
            onChange={(value) => setVals((prev) => ({ ...prev, sys: value }))}
            inputTestId={TESTIDS.NURSE_BP_INPUT_SYS}
          />
          <VitalCard
            label="血圧(下)"
            unit="mmHg"
            value={vals.dia}
            onChange={(value) => setVals((prev) => ({ ...prev, dia: value }))}
            inputTestId={TESTIDS.NURSE_BP_INPUT_DIA}
          />
          <VitalCard
            label="SpO2"
            unit="%"
            value={vals.spo2}
            onChange={(value) => setVals((prev) => ({ ...prev, spo2: value }))}
            isDanger={isDanger.spo2}
          />
          <VitalCard
            label="体重"
            unit="kg"
            value={vals.weight}
            onChange={(value) => setVals((prev) => ({ ...prev, weight: value }))}
            isDanger={isDanger.weight}
            step={0.1}
            describedById={weightAssistId}
          />
        </Box>
        <Typography
          id={weightAssistId}
          variant="caption"
          sx={{ mt: 0.75, ml: 0.5, fontWeight: 600, color: weightAssistTone, display: 'block' }}
        >
          {weightAssistText}
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ mt: { xs: 2, md: 2.5 } }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" component="h2" sx={{ fontWeight: 700 }}>
              状態メモ
            </Typography>
            {!isMemoOpen && hasMemoContent ? (
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>
                {tags.length > 0 ? `タグ: ${tags.join(' / ')}` : memoSummary}
              </Typography>
            ) : null}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant="text"
              onClick={() => setMemoOpen((prev) => !prev)}
              aria-expanded={isMemoOpen}
              aria-controls={memoPanelId}
              id={memoToggleId}
              data-testid={TESTIDS.NURSE_MEMO_TOGGLE}
            >
              {isMemoOpen ? 'メモを閉じる' : 'メモを開く'}
            </Button>
          </Stack>
          <Collapse
            in={isMemoOpen}
            timeout={collapseTimeout}
            unmountOnExit
            role="region"
            id={memoPanelId}
            aria-labelledby={memoToggleId}
            data-testid={TESTIDS.NURSE_MEMO_PANEL}
            sx={{ mt: 1 }}
          >
            <Box>
              <TagPills options={TAGS} value={tags} onChange={setTags} />
              <TextField
                placeholder="自由記述（音声入力の下書きも可）"
                fullWidth
                multiline
                minRows={3}
                sx={{ mt: 1 }}
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                data-testid={TESTIDS.NURSE_OBS_MEMO}
              />
            </Box>
          </Collapse>
          {!isMemoOpen && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              ※メモは折りたたみ中。開いて追記できます。
            </Typography>
          )}
        </CardContent>
      </Card>
      <Paper
        elevation={0}
        data-testid={TESTIDS.NURSE_ACTION_BAR}
        sx={{
          position: { md: 'sticky' },
          bottom: 0,
          zIndex: 1,
          mt: { xs: 2, md: 3 },
          px: { xs: 1.5, md: 3 },
          py: { xs: 1.5, md: 2 },
          bgcolor: 'background.paper',
          borderTop: { md: 1 },
          borderColor: { md: 'divider' },
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
          <Button variant="outlined" component={Link} to="/today">
            ◀ Todayへ戻る
          </Button>
          <Button variant="outlined">🎙️ 音声入力</Button>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="contained"
              onClick={() => handleSave()}
              disabled={isLoadingUsers}
              data-testid={TESTIDS.NURSE_OBS_SAVE}
            >
              保存
            </Button>
            <Button variant="outlined" onClick={() => handleSave(true)} disabled={isLoadingUsers}>
              保存して次へ ▶
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{selectedUserName ? `${selectedUserName} さんの確認` : 'しきい値超過の確認'}</DialogTitle>
        <DialogContent sx={{ whiteSpace: 'pre-wrap' }}>{confirmMsg}</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>戻る</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmOpen(false);
              enqueueObservation();
            }}
          >
            保存を続行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HealthObservationForm;
