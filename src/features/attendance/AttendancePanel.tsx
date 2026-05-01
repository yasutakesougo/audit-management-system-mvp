import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/TaskAlt';
import {
    Alert,
    Box,
    Button,
    Chip,
    Snackbar,
    Stack,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';

import { getNextTargetUserCode, scrollToUserRow } from './attendance.autoNext';
import { AbsenceDetailDialog } from './components/AbsenceDetailDialog';
import { AttendanceDetailDrawer } from './components/AttendanceDetailDrawer';
import { AttendanceFilterBar } from './components/AttendanceFilterBar';
import { AttendanceList } from './components/AttendanceList';
import { TemperatureKeypad } from './components/TemperatureKeypad';
import { useAttendance } from './useAttendance';

// ── Temperature draft (local state, no save) ──

type TempDialogState = {
  open: boolean;
  userCode: string;
  userName: string;
};

const TEMP_DIALOG_CLOSED: TempDialogState = { open: false, userCode: '', userName: '' };

const AttendancePanel = (): JSX.Element => {
  const { status, rows, filters, inputMode, savingUsers, savedTempsByUser, notification, dismissNotification, actions } = useAttendance();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  useEffect(() => {
    if (mode === 'checkin') {
      actions.setInputMode('checkInRun');
    } else if (mode === 'checkout') {
      actions.setInputMode('normal');
    }
  }, [mode, actions]);

  // ── Temperature draft state ──
  const [tempDraftByUser, setTempDraftByUser] = useState<Record<string, number>>({});

  // Merge: draft wins over saved
  const tempByUser = useMemo(() => {
    const out: Record<string, number> = { ...savedTempsByUser };
    for (const [userCode, v] of Object.entries(tempDraftByUser)) {
      if (v != null) out[userCode] = v;
    }
    return out;
  }, [savedTempsByUser, tempDraftByUser]);

  // Refs for stale-closure-safe auto-scroll
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const tempByUserRef = useRef(tempByUser);
  useEffect(() => { tempByUserRef.current = tempByUser; }, [tempByUser]);

  const [tempDialog, setTempDialog] = useState<TempDialogState>(TEMP_DIALOG_CLOSED);

  const openTempDialog = useCallback((userCode: string, userName: string) => {
    setTempDialog({ open: true, userCode, userName });
  }, []);

  const closeTempDialog = useCallback(() => {
    setTempDialog(TEMP_DIALOG_CLOSED);
  }, []);

  const handleTempConfirm = useCallback((temperature: number) => {
    const savedUserCode = tempDialog.userCode;
    setTempDraftByUser((prev) => ({ ...prev, [savedUserCode]: temperature }));
    closeTempDialog();
    // Persist to SharePoint via nurse observation upsert
    void actions.saveTemperature(savedUserCode, temperature, () => handleOpenNurse(savedUserCode));

    // C1.6: auto-scroll to next target in checkInRun mode
    if (inputMode === 'checkInRun') {
      setTimeout(() => {
        const next = getNextTargetUserCode(
          rowsRef.current,
          { ...tempByUserRef.current, [savedUserCode]: temperature },
        );
        if (next) scrollToUserRow(next);
      }, 0);
    }
  }, [tempDialog.userCode, closeTempDialog, actions, inputMode]);

  const handleOpenNurse = useCallback((userCode: string) => {
    navigate(`/nurse/observation?user=${userCode}`);
  }, [navigate]);

  // ── Detail drawer state ──
  const [detailUserCode, setDetailUserCode] = useState<string | null>(null);
  const detailRow = useMemo(
    () => (detailUserCode ? rows.find((r) => r.userCode === detailUserCode) ?? null : null),
    [detailUserCode, rows],
  );
  const handleOpenDetail = useCallback((userCode: string) => {
    setDetailUserCode(userCode);
  }, []);
  const handleCloseDetail = useCallback(() => {
    setDetailUserCode(null);
  }, []);

  // ── Transport method change handler ──
  const handleTransportToMethodChange = useCallback((method: import('../attendance/transportMethod').TransportMethod) => {
    if (!detailUserCode) return;
    void actions.updateRowFields(detailUserCode, { transportToMethod: method });
  }, [detailUserCode, actions]);

  const handleTransportFromMethodChange = useCallback((method: import('../attendance/transportMethod').TransportMethod) => {
    if (!detailUserCode) return;
    void actions.updateRowFields(detailUserCode, { transportFromMethod: method });
  }, [detailUserCode, actions]);

  // ── Transport note change handlers ──
  const handleTransportToNoteChange = useCallback((note: string) => {
    if (!detailUserCode) return;
    void actions.updateRowFields(detailUserCode, { transportToNote: note });
  }, [detailUserCode, actions]);

  const handleTransportFromNoteChange = useCallback((note: string) => {
    if (!detailUserCode) return;
    void actions.updateRowFields(detailUserCode, { transportFromNote: note });
  }, [detailUserCode, actions]);

  // ── User confirm handler ──
  const handleUserConfirm = useCallback(() => {
    if (!detailUserCode) return;
    void actions.updateRowFields(detailUserCode, { userConfirmedAt: new Date().toISOString() });
  }, [detailUserCode, actions]);

  // ── Absence detail dialog state ──
  type AbsenceDialogState = {
    open: boolean;
    userCode: string;
    userName: string;
    /** Non-null when editing existing absence */
    editData?: AbsentSupportLog;
  };
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState>({
    open: false, userCode: '', userName: '',
  });
  /** Track which section to focus when dialog opens from URL deep-link */
  const [absenceFocusSection, setAbsenceFocusSection] = useState<'morning' | 'evening' | undefined>();

  const handleAbsenceClick = useCallback((userCode: string) => {
    const row = rows.find((r) => r.userCode === userCode);
    const userName = row?.FullName ?? userCode;
    setAbsenceDialog({
      open: true,
      userCode,
      userName,
      editData: row?.absentSupport,
    });
  }, [rows]);

  const closeAbsenceDialog = useCallback(() => {
    setAbsenceDialog((prev) => ({ ...prev, open: false }));
    setAbsenceFocusSection(undefined);
  }, []);

  const handleAbsenceSubmit = useCallback((log: AbsentSupportLog) => {
    closeAbsenceDialog();
    void actions.updateStatusWithAbsentSupport(absenceDialog.userCode, log);
  }, [absenceDialog.userCode, actions, closeAbsenceDialog]);

  const handleAbsenceSkip = useCallback(() => {
    closeAbsenceDialog();
    void actions.updateStatus(absenceDialog.userCode, '当日欠席');
  }, [absenceDialog.userCode, actions, closeAbsenceDialog]);

  const handleAbsenceCancel = useCallback(() => {
    closeAbsenceDialog();
  }, [closeAbsenceDialog]);

  /** Open absence dialog in edit mode from drawer */
  const handleEditAbsenceFromDrawer = useCallback(() => {
    if (!detailRow) return;
    setAbsenceDialog({
      open: true,
      userCode: detailRow.userCode,
      userName: detailRow.FullName ?? detailRow.userCode,
      editData: detailRow.absentSupport,
    });
  }, [detailRow]);

  // ── Auto-open absence dialog from URL param (briefing → attendance flow) ──
  useEffect(() => {
    const absenceUserCode = searchParams.get('absence');
    if (!absenceUserCode || rows.length === 0) return;

    const sectionParam = searchParams.get('section');
    const row = rows.find((r) => r.userCode === absenceUserCode);
    const userName = row?.FullName ?? absenceUserCode;
    setAbsenceDialog({
      open: true,
      userCode: absenceUserCode,
      userName,
      editData: row?.absentSupport,
    });
    // Set focus section for auto-scroll (evening deep-link from briefing)
    if (sectionParam === 'evening') {
      setAbsenceFocusSection('evening');
    }

    // Clear the params so it doesn't re-trigger
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('absence');
      next.delete('section');
      return next;
    }, { replace: true });
  }, [searchParams, rows, setSearchParams]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0 }}>
      {status === 'error' ? (
        <Alert icon={<ErrorOutlineIcon />} severity="error">
          出欠データの読み込みに失敗しました。再読込を実行してください。
        </Alert>
      ) : null}

      <AttendanceFilterBar
        filters={filters}
        onChange={actions.setFilters}
        onRefresh={() => {
          void actions.refresh();
        }}
        disabled={status === 'loading'}
      />

      <Stack direction="row" spacing={1} alignItems="center">
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={(_, v) => { if (v) actions.setInputMode(v); }}
          size="small"
        >
          <ToggleButton value="normal" sx={{ minHeight: 36, px: 2 }}>通常</ToggleButton>
          <ToggleButton value="checkInRun" sx={{ minHeight: 36, px: 2 }}>通所連続</ToggleButton>
        </ToggleButtonGroup>
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label={`${rows.length}名`}
          variant="outlined"
          size="small"
        />
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <AttendanceList
          rows={rows}
          savingUsers={savingUsers}
          inputMode={inputMode}
          tempDraftByUser={tempByUser}
          onOpenTemp={openTempDialog}
          onOpenNurse={handleOpenNurse}
          onUpdateStatus={actions.updateStatus}
          onAbsence={handleAbsenceClick}
          onDetail={handleOpenDetail}
        />
      </Box>

      {/* Detail drawer */}
      <AttendanceDetailDrawer
        open={detailUserCode != null}
        user={detailRow ? { id: detailRow.userCode, name: detailRow.FullName ?? detailRow.userCode } : null}
        visit={detailRow ? {
          status: detailRow.status,
          transportTo: detailRow.transportTo,
          transportFrom: detailRow.transportFrom,
          transportToMethod: detailRow.transportToMethod,
          transportFromMethod: detailRow.transportFromMethod,
          transportToNote: detailRow.transportToNote,
          transportFromNote: detailRow.transportFromNote,
          isUserConfirmed: Boolean(detailRow.userConfirmedAt),
          absentMorningContacted: detailRow.absentMorningContacted,
          eveningChecked: detailRow.eveningChecked,
          isAbsenceAddonClaimable: detailRow.isAbsenceAddonClaimable,
        } : null}
        onClose={handleCloseDetail}
        onTransportToMethodChange={handleTransportToMethodChange}
        onTransportFromMethodChange={handleTransportFromMethodChange}
        onTransportToNoteChange={handleTransportToNoteChange}
        onTransportFromNoteChange={handleTransportFromNoteChange}
        onUserConfirm={handleUserConfirm}
        onEditAbsenceDetail={
          detailRow?.status === '当日欠席' ? handleEditAbsenceFromDrawer : undefined
        }
        onReset={detailUserCode ? () => { void actions.updateStatus(detailUserCode, '未'); handleCloseDetail(); } : undefined}
      />

      {/* Temperature keypad (replaces old TextField dialog) */}
      <TemperatureKeypad
        open={tempDialog.open}
        userName={tempDialog.userName}
        initialValue={tempDraftByUser[tempDialog.userCode]}
        onConfirm={handleTempConfirm}
        onCancel={closeTempDialog}
      />

      {/* Absence detail dialog */}
      <AbsenceDetailDialog
        open={absenceDialog.open}
        userName={absenceDialog.userName}
        initialData={absenceDialog.editData}
        focusSection={absenceFocusSection}
        onSubmit={handleAbsenceSubmit}
        onSkip={handleAbsenceSkip}
        onCancel={handleAbsenceCancel}
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={
          notification.actionLabel && notification.severity === 'success'
            ? 5000  // undo window
            : notification.severity === 'success'
              ? 3000
              : 6000
        }
        onClose={dismissNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notification.severity}
          onClose={dismissNotification}
          variant="filled"
          action={
            notification.actionLabel && notification.onAction ? (
              <Button color="inherit" size="small" onClick={notification.onAction}>
                {notification.actionLabel}
              </Button>
            ) : undefined
          }
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AttendancePanel;
