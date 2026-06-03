import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, IconButton, CircularProgress, Chip, Alert, Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, TextField, Snackbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import type { IUserMaster } from '@/features/users/types';
import { useAttendanceRepository } from '@/features/attendance/repositoryFactory';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { resolveKioskRecordDate } from '../utils/kioskDate';
import { normalizeAttendanceStatus, isAbsentStatus } from '../hooks/useKioskAttendance';
import type { AttendanceDailyItem } from '@/features/attendance/infra/Legacy/attendanceDailyRepository';

export const KioskUserSelectScreen: React.FC = () => {
  const location = useLocation();
  const { data: users, status, refresh: refreshUsers } = useUsersQuery({ selectMode: 'core' });
  const isLoadingUsers = status === 'loading';
  const hasLoadError = status === 'error';

  const attendanceRepo = useAttendanceRepository();
  const executionRepo = useExecutionData();
  const selectedDateIso = React.useMemo(() => resolveKioskRecordDate(location.search), [location.search]);

  const [dailyItems, setDailyItems] = useState<AttendanceDailyItem[]>([]);
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // オプションメニュー用
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuUser, setMenuUser] = useState<IUserMaster | null>(null);

  // 欠席ダイアログ用
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogUser, setDialogUser] = useState<IUserMaster | null>(null);
  const [absentReason, setAbsentReason] = useState('体調不良');
  const [absentMemo, setAbsentMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasExistingRecords, setHasExistingRecords] = useState<boolean | null>(null);
  const [checkingRecords, setCheckingRecords] = useState(false);

  // 欠席解除ダイアログ用
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // スナックバー用
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isLoading = isLoadingUsers || isDailyLoading;

  useEffect(() => {
    let active = true;
    setIsDailyLoading(true);
    const fetchAttendance = async () => {
      try {
        const items = await attendanceRepo.getDailyByDate({ recordDate: selectedDateIso });
        if (active) {
          setDailyItems(items || []);
          setIsDailyLoading(false);
        }
      } catch (err) {
        console.error('[KioskUserSelectScreen] Failed to fetch daily attendance:', err);
        if (active) {
          setIsDailyLoading(false);
        }
      }
    };
    void fetchAttendance();
    return () => {
      active = false;
    };
  }, [selectedDateIso, refreshTrigger]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, user: IUserMaster) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setMenuUser(user);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  const handleOpenDialog = async () => {
    if (!menuUser) return;
    const targetUser = menuUser;
    handleCloseMenu();
    setDialogUser(targetUser);
    setAbsentReason('体調不良');
    setAbsentMemo('');
    setSaveError(null);
    setIsDialogOpen(true);
    setCheckingRecords(true);

    try {
      const userCode = targetUser.UserID || String(targetUser.Id);
      const records = await executionRepo.getRecords(selectedDateIso, userCode);
      setHasExistingRecords(records.length > 0);
    } catch (err) {
      console.error('[KioskUserSelectScreen] Failed to check existing records:', err);
      setHasExistingRecords(false);
    } finally {
      setCheckingRecords(false);
    }
  };

  const handleOpenCancelDialog = async () => {
    if (!menuUser) return;
    const targetUser = menuUser;
    handleCloseMenu();
    setDialogUser(targetUser);
    setCancelError(null);
    setIsCancelDialogOpen(true);
    setCheckingRecords(true);

    try {
      const userCode = targetUser.UserID || String(targetUser.Id);
      const records = await executionRepo.getRecords(selectedDateIso, userCode);
      setHasExistingRecords(records.length > 0);
    } catch (err) {
      console.error('[KioskUserSelectScreen] Failed to check existing records:', err);
      setHasExistingRecords(false);
    } finally {
      setCheckingRecords(false);
    }
  };

  const handleCancelAbsence = async () => {
    if (!dialogUser || isCanceling) return;
    setIsCanceling(true);
    setCancelError(null);

    const userCode = dialogUser.UserID || String(dialogUser.Id);
    const key = `${userCode}|${selectedDateIso}`;

    const dailyItem: AttendanceDailyItem = {
      Key: key,
      UserCode: userCode,
      RecordDate: selectedDateIso,
      Status: '未',
      CntAttendIn: 0,
      CntAttendOut: 0,
      TransportTo: false,
      TransportFrom: false,
      ProvidedMinutes: 0,
      IsEarlyLeave: false,
      IsAbsenceAddonClaimable: false,
      CheckInAt: null,
      CheckOutAt: null,
      UserConfirmedAt: null,
    };

    try {
      await attendanceRepo.upsertDailyByKey(dailyItem);
      setSnackbarMessage(`${dialogUser.FullName}様の本日欠席処理を解除しました`);
      setIsSnackbarOpen(true);
      setIsCancelDialogOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('[KioskUserSelectScreen] Failed to cancel daily absence:', err);
      setCancelError('欠席処理の解除に失敗しました。しばらくしてから再試行してください。');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleSaveAbsence = async () => {
    if (!dialogUser || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const userCode = dialogUser.UserID || String(dialogUser.Id);
    const key = `${userCode}|${selectedDateIso}`;

    const dailyItem: AttendanceDailyItem = {
      Key: key,
      UserCode: userCode,
      RecordDate: selectedDateIso,
      Status: '当日欠席',
      AbsentReason: absentReason,
      AbsentSupportContent: absentMemo || undefined,
      CntAttendIn: 0,
      CntAttendOut: 0,
      TransportTo: false,
      TransportFrom: false,
      ProvidedMinutes: 0,
      IsEarlyLeave: false,
      IsAbsenceAddonClaimable: false,
      CheckInAt: null,
      CheckOutAt: null,
      UserConfirmedAt: null,
    };

    try {
      await attendanceRepo.upsertDailyByKey(dailyItem);
      setSnackbarMessage(`${dialogUser.FullName}様を本日欠席として処理しました`);
      setIsSnackbarOpen(true);
      setIsDialogOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('[KioskUserSelectScreen] Failed to save daily absence:', err);
      setSaveError('欠席処理の保存に失敗しました。しばらくしてから再試行してください。');
    } finally {
      setIsSaving(false);
    }
  };

  const getAbsenceState = (user: IUserMaster) => {
    const userCode = String(user.UserID || '').trim().toUpperCase();
    const fallbackId = String(user.Id || '').trim().toUpperCase();

    const record = dailyItems.find((item) => {
      const itemUserUpper = String(item.UserCode ?? '').trim().toUpperCase();
      return itemUserUpper === userCode || itemUserUpper === fallbackId;
    });

    if (record) {
      const normalized = normalizeAttendanceStatus(record.Status);
      return isAbsentStatus(normalized);
    }
    return false;
  };

  const refreshAll = () => {
    void refreshUsers();
    setRefreshTrigger((prev) => prev + 1);
  };

  // キオスクモードでは「支援手順対象」または「強度行動障害支援対象」の利用者を表示。
  // IsActive が明示的に false の場合は除外する。
  const activeUsers = users.filter(u => 
    (u.IsSupportProcedureTarget || u.IsHighIntensitySupportTarget) && 
    u.IsActive !== false
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: { xs: 2, md: 4 }, display: 'flex', alignItems: 'center' }}>
        <IconButton 
          component={RouterLink}
          to={appendKioskSearchParams('/kiosk', location.search)} 
          sx={{ mr: 2, bgcolor: 'action.hover' }}
          data-testid="kiosk-user-select-back"
        >
          <ArrowBackIcon fontSize="medium" />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          利用者を選択してください
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={48} />
        </Box>
      ) : hasLoadError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={refreshAll}>
              再読み込み
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            利用者の読み込みに失敗しました
          </Typography>
          <Typography variant="body2">
            対象者なしではありません。通信状態または認証状態を確認して再読み込みしてください。
          </Typography>
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {activeUsers.map((user) => {
            const isAbsent = getAbsenceState(user);
            return (
              <Grid key={user.Id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    '&:active': { transform: 'scale(0.98)' },
                    transition: 'transform 0.1s',
                    opacity: isAbsent ? 0.6 : 1,
                    position: 'relative'
                  }}
                  data-testid={`kiosk-user-card-${user.Id}`}
                >
                  <IconButton
                    onClick={(e) => handleOpenMenu(e, user)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 2,
                      color: 'text.secondary',
                      bgcolor: 'background.paper',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    data-testid={`kiosk-user-menu-trigger-${user.Id}`}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                  <CardActionArea
                    component={RouterLink}
                    to={appendKioskSearchParams(`/kiosk/users/${user.Id}/procedures`, location.search)}
                    sx={{ height: '100%', p: { xs: 2, md: 3 } }}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 0 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5, letterSpacing: '0.05em' }}
                      >
                        {user.Furigana || '　'}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {user.FullName}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        {isAbsent && (
                          <Chip
                            label="本日欠席"
                            size="small"
                            sx={{
                              fontWeight: 'bold',
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              bgcolor: 'grey.400',
                              color: 'common.white'
                            }}
                            data-testid={`kiosk-user-absent-chip-${user.Id}`}
                          />
                        )}
                        {user.IsHighIntensitySupportTarget && (
                          <Chip
                            label="強度行動障害支援対象"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 'bold', borderRadius: 1, fontSize: '0.75rem' }}
                          />
                        )}
                        {user.IsSupportProcedureTarget && !user.IsHighIntensitySupportTarget && (
                          <Chip
                            label="支援手順対象"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 'bold', borderRadius: 1, fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
          {activeUsers.length === 0 && (
            <Grid size={12}>
              <Box sx={{ p: 6, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
                <Typography variant="subtitle1" color="text.secondary">
                  対象の利用者がいません
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* オプションメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        data-testid="kiosk-user-option-menu"
      >
        {menuUser && getAbsenceState(menuUser) ? (
          <MenuItem onClick={handleOpenCancelDialog} data-testid="kiosk-user-menu-cancel-absent">
            欠席処理を解除する
          </MenuItem>
        ) : (
          <MenuItem onClick={handleOpenDialog} data-testid="kiosk-user-menu-absent">
            本日欠席として処理
          </MenuItem>
        )}
      </Menu>

      {/* 欠席登録ダイアログ */}
      <Dialog
        open={isDialogOpen}
        onClose={() => !isSaving && setIsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        data-testid="kiosk-absent-dialog"
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          本日欠席として処理 ({dialogUser?.FullName} 様)
        </DialogTitle>
        <DialogContent dividers>
          {checkingRecords ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : hasExistingRecords ? (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="kiosk-absent-dialog-error">
              本日の実施記録が既にあります。欠席処理は後続対応で扱うため、この画面では保存できません。
            </Alert>
          ) : null}

          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel id="absent-reason-label">欠席理由</InputLabel>
            <Select
              labelId="absent-reason-label"
              value={absentReason}
              label="欠席理由"
              onChange={(e) => setAbsentReason(e.target.value)}
              disabled={isSaving || hasExistingRecords === true}
              inputProps={{ 'data-testid': 'kiosk-absent-dialog-reason' }}
            >
              <MenuItem value="体調不良">体調不良</MenuItem>
              <MenuItem value="家庭都合">家庭都合</MenuItem>
              <MenuItem value="予定欠席">予定欠席</MenuItem>
              <MenuItem value="連絡なし">連絡なし</MenuItem>
              <MenuItem value="その他">その他</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="補足メモ"
            multiline
            rows={3}
            value={absentMemo}
            onChange={(e) => setAbsentMemo(e.target.value)}
            disabled={isSaving || hasExistingRecords === true}
            placeholder="連絡手段や詳細などを入力（任意）"
            inputProps={{ 'data-testid': 'kiosk-absent-dialog-memo' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setIsDialogOpen(false)}
            disabled={isSaving}
            variant="outlined"
            color="inherit"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSaveAbsence}
            color="primary"
            variant="contained"
            disabled={isSaving || checkingRecords || hasExistingRecords === true}
            data-testid="kiosk-absent-dialog-submit"
          >
            {isSaving ? <CircularProgress size={20} color="inherit" /> : '欠席として処理する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 欠席解除確認ダイアログ */}
      <Dialog
        open={isCancelDialogOpen}
        onClose={() => !isCanceling && setIsCancelDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        data-testid="kiosk-cancel-absent-dialog"
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          欠席処理を解除しますか？
        </DialogTitle>
        <DialogContent dividers>
          {checkingRecords ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : hasExistingRecords ? (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="kiosk-cancel-absent-dialog-warning">
              本日の実施記録が存在します。欠席処理を解除すると、既存の実施記録が通常の記録として扱われます。解除してよろしいですか？
            </Alert>
          ) : null}

          {cancelError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelError}
            </Alert>
          )}

          <Typography variant="body1">
            {dialogUser?.FullName} 様の本日欠席処理を解除します。
            解除すると、手順記録の登録や変更ができるようになります。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setIsCancelDialogOpen(false)}
            disabled={isCanceling}
            variant="outlined"
            color="inherit"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCancelAbsence}
            color="primary"
            variant="contained"
            disabled={isCanceling || checkingRecords}
            data-testid="kiosk-cancel-absent-dialog-submit"
          >
            {isCanceling ? <CircularProgress size={20} color="inherit" /> : '解除する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={4000}
        onClose={() => setIsSnackbarOpen(false)}
        message={snackbarMessage}
        data-testid="kiosk-absent-snackbar"
      />
    </Box>
  );
};
