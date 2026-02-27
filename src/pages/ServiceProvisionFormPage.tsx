/**
 * ServiceProvisionFormPage — サービス提供実績記録フォーム
 *
 * MVP0: 利用者×日付の実績を1件保存するシンプルなフォーム。
 * - 利用者選択（useDailyUserOptions 再利用）
 * - 日付（今日初期値）
 * - ステータス（提供/欠席/その他）
 * - 時刻（任意）
 * - 加算チェック（任意）
 * - メモ（任意）
 * - 保存 → toast通知
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ListAltIcon from '@mui/icons-material/ListAlt';

import { useDailyUserOptions } from '@/features/daily';
import type { DailyUserOption } from '@/features/daily';
import { useServiceProvisionSave, useServiceProvisionList } from '@/features/service-provision';
import type { AbsentSupportLog, FollowUpResult } from '@/features/service-provision/domain/absentSupportLog';
import { EMPTY_ABSENT_LOG, buildNoteWithAbsentLog } from '@/features/service-provision/domain/absentSupportLog';
import type { ServiceProvisionStatus, ServiceProvisionRecord, UpsertProvisionInput } from '@/features/service-provision';

// ─── ヘルパー ────────────────────────────────────────────────

const todayISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** "HH:MM" → HHMM数値。不正なら null */
const parseHHMM = (value: string): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 100 + mm;
};

/** HHMM数値 → "HH:MM" */
const formatHHMM = (value: number | null | undefined): string => {
  if (value == null) return '—';
  const hh = Math.floor(value / 100);
  const mm = value % 100;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const STATUS_OPTIONS: ServiceProvisionStatus[] = ['提供', '欠席', 'その他'];

const STATUS_COLOR: Record<ServiceProvisionStatus, 'success' | 'warning' | 'default'> = {
  '提供': 'success',
  '欠席': 'warning',
  'その他': 'default',
};

/** 加算フラグをラベル配列に変換 */
const getAddonLabels = (r: ServiceProvisionRecord): string[] => {
  const labels: string[] = [];
  if (r.hasTransportPickup && r.hasTransportDropoff) labels.push('送迎:往復');
  else if (r.hasTransportPickup) labels.push('送迎:往');
  else if (r.hasTransportDropoff) labels.push('送迎:復');
  else if (r.hasTransport) labels.push('送迎');
  if (r.hasMeal) labels.push('食事');
  if (r.hasBath) labels.push('入浴');
  if (r.hasExtended) labels.push('延長');
  if (r.hasAbsentSupport) labels.push('欠席対応');
  return labels;
};

// ─── コンポーネント ──────────────────────────────────────────

const ServiceProvisionFormPage: React.FC = () => {
  const { options: userOptions } = useDailyUserOptions();
  const { status: saveStatus, save } = useServiceProvisionSave();

  // 日次一覧
  const [recordDate, setRecordDate] = useState(todayISO());
  const { records, loading: listLoading, refresh } = useServiceProvisionList(recordDate);

  // フォーム状態
  const [selectedUser, setSelectedUser] = useState<DailyUserOption | null>(null);
  const [provisionStatus, setProvisionStatus] = useState<ServiceProvisionStatus>('提供');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hasTransportPickup, setHasTransportPickup] = useState(false);
  const [hasTransportDropoff, setHasTransportDropoff] = useState(false);
  const [transportTouched, setTransportTouched] = useState(false);
  const [hasMeal, setHasMeal] = useState(false);
  const [hasBath, setHasBath] = useState(false);
  const [hasExtended, setHasExtended] = useState(false);
  const [hasAbsentSupport, setHasAbsentSupport] = useState(false);
  const [absentLog, setAbsentLog] = useState<AbsentSupportLog>({ ...EMPTY_ABSENT_LOG });
  const setLogField = <K extends keyof AbsentSupportLog>(k: K, v: AbsentSupportLog[K]) =>
    setAbsentLog((prev) => ({ ...prev, [k]: v }));
  const [note, setNote] = useState('');

  const isSaving = saveStatus === 'saving';

  const canSave = useMemo(
    () => !!selectedUser && !!recordDate && !isSaving,
    [selectedUser, recordDate, isSaving],
  );

  // ── 送迎初期値：マスタの TransportAdditionType から自動セット ──
  useEffect(() => {
    if (!selectedUser) return;
    if (transportTouched) return;
    const t = selectedUser.transportAdditionType;
    if (t === 'both') { setHasTransportPickup(true); setHasTransportDropoff(true); return; }
    if (t === 'oneway-to') { setHasTransportPickup(true); setHasTransportDropoff(false); return; }
    if (t === 'oneway-from') { setHasTransportPickup(false); setHasTransportDropoff(true); return; }
    setHasTransportPickup(false); setHasTransportDropoff(false);
  }, [selectedUser, transportTouched]);

  const handleSave = useCallback(async () => {
    if (!selectedUser) return;

    // 片側だけ時刻が入っている場合は警告（MVP0ではブロックしない）
    const start = parseHHMM(startTime);
    const end = parseHHMM(endTime);
    if ((start != null && end == null) || (start == null && end != null)) {
      toast('開始時刻と終了時刻は両方入力するのがおすすめです', { icon: '⚠️' });
    }

    // userCode: DailyUserOption.id は UserID（= UserCode I022）
    const userCode = selectedUser.id;

    const input: UpsertProvisionInput = {
      userCode,
      recordDateISO: recordDate,
      status: provisionStatus,
      startHHMM: start,
      endHHMM: end,
      hasTransport: hasTransportPickup || hasTransportDropoff,
      hasTransportPickup,
      hasTransportDropoff,
      hasMeal,
      hasBath,
      hasExtended,
      hasAbsentSupport,
      note: (hasAbsentSupport
        ? buildNoteWithAbsentLog(note, absentLog)
        : note.trim()) || undefined,
      source: 'Unified',
    };

    const result = await save(input);
    if (result) {
      toast.success(`保存しました（${selectedUser.label} / ${recordDate}）`);
      // 保存後に一覧をリフレッシュ
      await refresh();
    } else {
      toast.error('保存に失敗しました（SPリスト名・列・選択肢・権限を確認）');
    }
  }, [
    selectedUser,
    recordDate,
    provisionStatus,
    startTime,
    endTime,
    hasTransportPickup,
    hasTransportDropoff,
    hasMeal,
    hasBath,
    hasExtended,
    hasAbsentSupport,
    absentLog,
    note,
    save,
    refresh,
  ]);

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', py: 3, px: 2 }}>
      <Toaster position="top-center" />

      {/* ── ヘッダー ─────────────────────────────────── */}
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          data-testid="heading-service-provision"
        >
          <AssignmentIcon color="primary" />
          サービス提供実績記録
        </Typography>
        <Typography color="text.secondary" variant="body2">
          利用者ごとの提供実績を記録・保存します。
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {/* ── 利用者選択 ───────────────────────────── */}
          <Autocomplete
            options={userOptions}
            getOptionLabel={(option) =>
              `${option.label}（${option.id}）`
            }
            value={selectedUser}
            onChange={(_e, value) => setSelectedUser(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="利用者"
                placeholder="名前またはIDで検索"
                required
                data-testid="input-user-code"
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="利用者が見つかりません"
          />

          {/* ── 日付 ─────────────────────────────────── */}
          <TextField
            label="記録日"
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            required
            InputLabelProps={{ shrink: true }}
            data-testid="input-record-date"
          />

          {/* ── 提供状況 ─────────────────────────────── */}
          <FormControl required>
            <InputLabel>提供状況</InputLabel>
            <Select
              value={provisionStatus}
              label="提供状況"
              onChange={(e) =>
                setProvisionStatus(e.target.value as ServiceProvisionStatus)
              }
              data-testid="select-status"
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── 時刻 ─────────────────────────────────── */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="開始時刻"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
              data-testid="input-start-time"
            />
            <TextField
              label="終了時刻"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
              data-testid="input-end-time"
            />
          </Stack>

          {/* ── 加算チェック ──────────────────────────── */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              加算項目
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasTransportPickup}
                    onChange={(e) => { setHasTransportPickup(e.target.checked); setTransportTouched(true); }}
                    size="small"
                  />
                }
                label="送迎：往"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasTransportDropoff}
                    onChange={(e) => { setHasTransportDropoff(e.target.checked); setTransportTouched(true); }}
                    size="small"
                  />
                }
                label="送迎：復"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasMeal}
                    onChange={(e) => setHasMeal(e.target.checked)}
                    size="small"
                  />
                }
                label="食事"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasBath}
                    onChange={(e) => setHasBath(e.target.checked)}
                    size="small"
                  />
                }
                label="入浴"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasExtended}
                    onChange={(e) => setHasExtended(e.target.checked)}
                    size="small"
                  />
                }
                label="延長"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasAbsentSupport}
                    onChange={(e) => setHasAbsentSupport(e.target.checked)}
                    size="small"
                  />
                }
                label="欠席時対応"
              />
            </Stack>
          </Box>

          {/* ── メモ ─────────────────────────────────── */}

          {/* 欠席時対応ログ展開 */}
          <Collapse in={hasAbsentSupport}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>① 欠席連絡受け入れ</Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="受電日時"
                type="datetime-local"
                size="small"
                value={absentLog.contactDateTime}
                onChange={(e) => setLogField('contactDateTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="連絡者（相手）"
                size="small"
                placeholder="例: 母"
                value={absentLog.contactPerson}
                onChange={(e) => setLogField('contactPerson', e.target.value)}
              />
              <TextField
                label="欠席理由"
                size="small"
                placeholder="例: 発熱"
                value={absentLog.absenceReason}
                onChange={(e) => setLogField('absenceReason', e.target.value)}
              />
              <TextField
                label="対応内容（相談援助）"
                size="small"
                multiline
                minRows={2}
                placeholder="例: 水分摂取・受診を助言"
                value={absentLog.supportContent}
                onChange={(e) => setLogField('supportContent', e.target.value)}
              />
            </Stack>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>② 様子伺い（夕方連絡）</Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <FormControl size="small">
                <Typography variant="caption" sx={{ mb: 0.5 }}>結果</Typography>
                <RadioGroup
                  row
                  value={absentLog.followUpResult}
                  onChange={(e) => setLogField('followUpResult', e.target.value as FollowUpResult)}
                >
                  <FormControlLabel value="実施" control={<Radio size="small" />} label="実施" />
                  <FormControlLabel value="不通" control={<Radio size="small" />} label="不通" />
                  <FormControlLabel value="不要" control={<Radio size="small" />} label="不要" />
                </RadioGroup>
              </FormControl>
              <TextField
                label="連絡日時"
                type="datetime-local"
                size="small"
                value={absentLog.followUpDateTime}
                onChange={(e) => setLogField('followUpDateTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="連絡先"
                size="small"
                placeholder="例: 母"
                value={absentLog.followUpTarget}
                onChange={(e) => setLogField('followUpTarget', e.target.value)}
              />
              <TextField
                label="確認内容"
                size="small"
                multiline
                minRows={2}
                placeholder={absentLog.followUpResult === '不通' ? '例: 留守電あり、折返し依頼' : '例: 熱は下がった、明日利用予定'}
                value={absentLog.followUpContent}
                onChange={(e) => setLogField('followUpContent', e.target.value)}
              />
            </Stack>

            <TextField
              label="次回利用予定日"
              type="date"
              size="small"
              value={absentLog.nextPlannedDate}
              onChange={(e) => setLogField('nextPlannedDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <Divider sx={{ mb: 2 }} />
          </Collapse>

          <TextField
            label="メモ"
            multiline
            minRows={2}
            maxRows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            data-testid="input-note"
          />

          {/* ── 保存ボタン ───────────────────────────── */}
          <Button
            variant="contained"
            size="large"
            startIcon={
              isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />
            }
            onClick={handleSave}
            disabled={!canSave}
            data-testid="btn-save"
            sx={{ mt: 1 }}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </Stack>
      </Paper>

      {/* ── 日次一覧 ───────────────────────────────────── */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
          data-testid="heading-daily-list"
        >
          <ListAltIcon color="primary" />
          {recordDate} の実績一覧
          {listLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        </Typography>

        {records.length === 0 && !listLoading ? (
          <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: 'center' }}>
            この日の実績はまだありません
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>利用者</TableCell>
                  <TableCell>状況</TableCell>
                  <TableCell>開始</TableCell>
                  <TableCell>終了</TableCell>
                  <TableCell>加算</TableCell>
                  <TableCell>メモ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.entryKey} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.userCode}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.status}
                        size="small"
                        color={STATUS_COLOR[r.status] ?? 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatHHMM(r.startHHMM)}</TableCell>
                    <TableCell>{formatHHMM(r.endHHMM)}</TableCell>
                    <TableCell>
                      {getAddonLabels(r).map((label) => (
                        <Chip key={label} label={label} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.note || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default ServiceProvisionFormPage;
