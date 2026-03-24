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

import AssignmentIcon from '@mui/icons-material/Assignment';
import SaveIcon from '@mui/icons-material/Save';
import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Collapse,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';

import type { DailyUserOption } from '@/features/daily';
import { useDailyUserOptions } from '@/features/daily';
import type { ServiceProvisionStatus, UpsertProvisionInput } from '@/features/service-provision';
import { useServiceProvisionList, useServiceProvisionSave } from '@/features/service-provision';
import { AbsentSupportLogForm } from '@/features/service-provision/components/AbsentSupportLogForm';
import IsokatsuSheetPreview from '@/features/service-provision/components/IsokatsuSheetPreview';
import { ProvisionDailyTable } from '@/features/service-provision/components/ProvisionDailyTable';
import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';
import { buildNoteWithAbsentLog, EMPTY_ABSENT_LOG } from '@/features/service-provision/domain/absentSupportLog';
import {
    parseHHMM,
    STATUS_OPTIONS,
    todayISO
} from '@/features/service-provision/serviceProvisionFormHelpers';
import { useIsokatsuPreviewData } from '@/features/service-provision/useIsokatsuPreviewData';
import { useSyncAttendance } from '@/features/service-provision/useSyncAttendance';
import PrintIcon from '@mui/icons-material/Print';
import SyncIcon from '@mui/icons-material/Sync';

// ─── 印刷用 CSS ────────────────────────────────────────────
// window.print() 時にプレビュー部分だけを出力する
const PRINT_STYLE = `
@media print {
  body > *:not(#root) { display: none !important; }
  #root > *:not(.MuiBox-root) { display: none !important; }
  .isokatsu-preview-section { box-shadow: none !important; }
  .isokatsu-preview-section > *:not(.isokatsu-print-area) { display: none !important; }
  .isokatsu-print-area { margin: 0 !important; padding: 0 !important; }
}
`;

// ─── コンポーネント ──────────────────────────────────────────



const ServiceProvisionFormPage: React.FC = () => {
  const { options: userOptions } = useDailyUserOptions();
  const { status: saveStatus, save } = useServiceProvisionSave();

  // 日次一覧
  const [recordDate, setRecordDate] = useState(todayISO());
  const { records, loading: listLoading, refresh } = useServiceProvisionList(recordDate);

  // 通園データ同期
  const { syncStatus, syncedCount, syncError, syncMonth } = useSyncAttendance();
  const isSyncing = syncStatus === 'syncing';

  // フォーム状態
  const [selectedUser, setSelectedUser] = useState<DailyUserOption | null>(null);

  // 月次プレビューデータ
  const { previewProps, loading: previewLoading } = useIsokatsuPreviewData({
    yearMonth: recordDate.slice(0, 7),
    selectedUserCode: selectedUser?.id ?? null,
    selectedUserName: selectedUser?.label ?? null,
  });

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
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />
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

      {/* ── 通園データ同期 ────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#f0f4ff' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SyncIcon color="info" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">通所管理データを同期</Typography>
            <Typography variant="caption" color="text.secondary">
              /daily/attendance の入退所データをサービス提供実績に変換します
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
            disabled={isSyncing}
            onClick={async () => {
              const monthStr = recordDate.slice(0, 7);
              const count = await syncMonth(monthStr);
              if (count > 0) {
                toast.success(`${count}件の実績を同期しました`);
                await refresh();
              } else if (syncError) {
                toast.error(`同期エラー: ${syncError}`);
              } else {
                toast('同期対象のデータがありませんでした', { icon: 'ℹ️' });
              }
            }}
          >
            {isSyncing ? '同期中...' : `${recordDate.slice(0, 7)} 月の同期`}
          </Button>
        </Stack>
        {syncStatus === 'done' && syncedCount > 0 && (
          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
            ✓ {syncedCount}件の実績を同期完了
          </Typography>
        )}
      </Paper>

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
            <AbsentSupportLogForm absentLog={absentLog} setLogField={setLogField} />
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
      <ProvisionDailyTable records={records} loading={listLoading} recordDate={recordDate} />

      {/* ── いそかつ書式プレビュー ─────────────────────── */}
      <Paper sx={{ p: 3, mt: 3, overflow: 'auto' }} className="isokatsu-preview-section">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography
            variant="h6"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PrintIcon color="primary" />
            帳票プレビュー（いそかつ書式）
          </Typography>
          {previewProps && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              data-testid="btn-print"
            >
              印刷
            </Button>
          )}
        </Stack>

        {previewLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : previewProps ? (
          <Box className="isokatsu-print-area">
            <IsokatsuSheetPreview {...previewProps} />
          </Box>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: 'center',
              color: 'text.secondary',
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <PrintIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
            <Typography variant="body2">
              利用者を選択すると月次プレビューが表示されます
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ServiceProvisionFormPage;
