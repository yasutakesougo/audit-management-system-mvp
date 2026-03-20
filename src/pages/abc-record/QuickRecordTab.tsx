/**
 * QuickRecordTab — 簡易記録フォーム
 *
 * 現場でサッと30秒〜1分で ABC 行動記録を入力するためのフォーム。
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// ── Icons ──
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

// ── Domain ──
import type { AbcRecord, AbcRecordCreateInput, AbcRecordSourceContext } from '@/domain/abc/abcRecord';
import { ABC_INTENSITY_VALUES, ABC_INTENSITY_DISPLAY } from '@/domain/abc/abcRecord';
import type { AbcIntensity } from '@/domain/abc/abcRecord';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';

// ── Local ──
import type { UserOption } from './types';
import { EMPTY_FORM, SETTING_PRESETS, TAG_PRESETS } from './constants';

interface QuickRecordTabProps {
  users: UserOption[];
  recorderName: string;
  onSaved: () => void;
  initialUserId?: string;
  todayRecords: AbcRecord[];
  /** daily-support 等からの遷移時に保存するコンテキスト */
  sourceContext?: AbcRecordSourceContext;
  /** MVP-5: Step 3 からの下書き behavior テキスト */
  initialBehavior?: string;
}

const QuickRecordTab: React.FC<QuickRecordTabProps> = ({ users, recorderName, onSaved, initialUserId, todayRecords, sourceContext, initialBehavior }) => {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSavedUserId, setLastSavedUserId] = useState<string | null>(null);

  // URL userId → 初期利用者を自動選択
  useEffect(() => {
    if (initialUserId && !selectedUser && users.length > 0) {
      const found = users.find(u => u.id === initialUserId);
      if (found) setSelectedUser(found);
    }
  }, [initialUserId, users, selectedUser]);

  // MVP-5: 下書き behavior を初期値としてセット
  const [draftApplied, setDraftApplied] = useState(false);
  useEffect(() => {
    if (initialBehavior && !draftApplied) {
      setForm(prev => ({ ...prev, behavior: initialBehavior }));
      setDraftApplied(true);
    }
  }, [initialBehavior, draftApplied]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const canSave = !!(selectedUser && form.antecedent.trim() && form.behavior.trim() && form.consequence.trim());

  const handleSave = useCallback(async () => {
    if (!selectedUser || !canSave) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const input: AbcRecordCreateInput = {
        userId: selectedUser.id,
        userName: selectedUser.label,
        occurredAt: form.occurredAt || new Date().toISOString(),
        setting: form.setting,
        antecedent: form.antecedent.trim(),
        behavior: form.behavior.trim(),
        consequence: form.consequence.trim(),
        intensity: form.intensity,
        durationMinutes: form.durationMinutes,
        riskFlag: form.riskFlag,
        recorderName,
        tags: form.tags,
        notes: form.notes.trim(),
        ...(sourceContext ? { sourceContext } : {}),
      };
      await localAbcRecordRepository.save(input);
      setSaveSuccess(true);
      setLastSavedUserId(selectedUser.id);
      // リセット（利用者は維持）
      setForm({
        ...EMPTY_FORM,
        occurredAt: new Date().toISOString().slice(0, 16),
      });
      onSaved();
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(`保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedUser, form, canSave, recorderName, onSaved]);

  return (
    <Stack spacing={2.5}>
      {/* ── 利用者 + 日時 ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Autocomplete
          options={users}
          value={selectedUser}
          onChange={(_, v) => setSelectedUser(v)}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          renderInput={params => <TextField {...params} label="利用者 *" placeholder="名前 or ID" size="small" />}
          sx={{ flex: 2 }}
          noOptionsText="該当なし"
        />
        <TextField
          type="datetime-local"
          label="発生日時"
          value={form.occurredAt}
          onChange={e => updateField('occurredAt', e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      {/* ── 場面（プリセット） ── */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>場面</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {SETTING_PRESETS.map(s => (
            <Chip
              key={s}
              label={s}
              size="small"
              variant={form.setting === s ? 'filled' : 'outlined'}
              color={form.setting === s ? 'primary' : 'default'}
              onClick={() => updateField('setting', form.setting === s ? '' : s)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
        <TextField
          value={form.setting}
          onChange={e => updateField('setting', e.target.value)}
          size="small"
          fullWidth
          placeholder="場面を選択 or 自由入力"
        />
      </Box>

      <Divider />

      {/* ── ABC 入力（コア） ── */}
      <Paper variant="outlined" sx={{ p: 2, borderColor: 'warning.main', borderWidth: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle2" fontWeight={700} color="warning.main">
            🔍 ABC 観察記録
          </Typography>
          {draftApplied && form.behavior && (
            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              📝 支援手順から行動の下書きが入力されています。内容を確認・編集してください。
            </Alert>
          )}
          <TextField
            label="A: 直前の状況（何が起きた？）"
            value={form.antecedent}
            onChange={e => updateField('antecedent', e.target.value)}
            required
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="行動の直前に何があったか"
          />
          <TextField
            label="B: 行動（何をした？）"
            value={form.behavior}
            onChange={e => updateField('behavior', e.target.value)}
            required
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="具体的にどんな行動が出たか"
          />
          <TextField
            label="C: 結果（その後どうなった？）"
            value={form.consequence}
            onChange={e => updateField('consequence', e.target.value)}
            required
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="周囲の対応と、その後の変化"
          />
        </Stack>
      </Paper>

      {/* ── 強度・時間・危険性 ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField select label="強度" value={form.intensity} onChange={e => updateField('intensity', e.target.value as AbcIntensity)} size="small" sx={{ minWidth: 120 }}>
          {ABC_INTENSITY_VALUES.map(v => <MenuItem key={v} value={v}>{ABC_INTENSITY_DISPLAY[v]}</MenuItem>)}
        </TextField>
        <TextField
          type="number"
          label="継続時間（分）"
          value={form.durationMinutes ?? ''}
          onChange={e => updateField('durationMinutes', e.target.value ? Number(e.target.value) : null)}
          size="small"
          sx={{ minWidth: 130 }}
          inputProps={{ min: 0 }}
        />
        <FormControlLabel
          control={<Switch checked={form.riskFlag} onChange={e => updateField('riskFlag', e.target.checked)} color="error" />}
          label={<Stack direction="row" spacing={0.5} alignItems="center">
            <WarningAmberRoundedIcon fontSize="small" color={form.riskFlag ? 'error' : 'disabled'} />
            <Typography variant="body2">危険行動</Typography>
          </Stack>}
        />
      </Stack>

      {/* ── タグ ── */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>タグ</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {TAG_PRESETS.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant={form.tags.includes(tag) ? 'filled' : 'outlined'}
              color={form.tags.includes(tag) ? 'secondary' : 'default'}
              onClick={() => {
                const next = form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag];
                updateField('tags', next);
              }}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>

      {/* ── メモ ── */}
      <TextField
        label="メモ（任意）"
        value={form.notes}
        onChange={e => updateField('notes', e.target.value)}
        size="small"
        fullWidth
        multiline
        minRows={1}
        placeholder="補足情報があれば"
      />

      {/* ── フィードバック ── */}
      {saveSuccess && (
        <Alert
          severity="success"
          variant="outlined"
          action={
            lastSavedUserId ? (
              <Button
                size="small"
                color="secondary"
                startIcon={<BubbleChartRoundedIcon />}
                onClick={() => navigate(buildIcebergPdcaUrl(lastSavedUserId, { source: 'abc-record' }))}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                氷山PDCAで分析
              </Button>
            ) : undefined
          }
        >
          ✅ ABC 記録を保存しました。続けて入力できます。
        </Alert>
      )}
      {saveError && <Alert severity="error" variant="outlined">{saveError}</Alert>}

      {/* ── 保存ボタン ── */}
      <Button
        variant="contained"
        size="large"
        startIcon={<SaveRoundedIcon />}
        onClick={handleSave}
        disabled={!canSave || isSaving}
        fullWidth
      >
        {isSaving ? '保存中…' : 'ABC 記録を保存'}
      </Button>

      {/* ── 今日のABC ミニ一覧 ── */}
      {todayRecords.length > 0 && (
        <>
          <Divider sx={{ mt: 2 }} />
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
              📋 今日の記録 ({todayRecords.length}件)
            </Typography>
            <Stack spacing={0.75}>
              {todayRecords.map(r => (
                <Paper
                  key={r.id}
                  variant="outlined"
                  sx={{
                    px: 1.5, py: 1,
                    display: 'flex', alignItems: 'center', gap: 1,
                    borderLeftWidth: 3,
                    borderLeftColor: r.riskFlag ? 'error.main' : r.intensity === 'high' ? 'warning.main' : 'grey.300',
                  }}
                >
                  <Typography variant="caption" color="primary" fontWeight={700} sx={{ minWidth: 40 }}>
                    {new Date(r.occurredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {r.setting && (
                    <Chip label={r.setting} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {r.behavior}
                  </Typography>
                  <Chip
                    label={ABC_INTENSITY_DISPLAY[r.intensity]}
                    size="small"
                    color={r.intensity === 'low' ? 'success' : r.intensity === 'medium' ? 'warning' : 'error'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                  {r.riskFlag && (
                    <WarningAmberRoundedIcon fontSize="small" color="error" />
                  )}
                  <Tooltip title="氷山PDCAで分析">
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => navigate(buildIcebergPdcaUrl(r.userId, { source: 'abc-record' }))}
                      sx={{ ml: 'auto', flexShrink: 0 }}
                    >
                      <BubbleChartRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
};

export default QuickRecordTab;
