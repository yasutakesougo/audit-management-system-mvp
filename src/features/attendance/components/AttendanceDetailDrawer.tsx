import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
    Box,
    Button,
    Chip,
    Divider,
    Drawer,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    type SelectChangeEvent,
    Typography,
} from '@mui/material';

import {
    TRANSPORT_METHODS,
    TRANSPORT_METHOD_LABEL,
    type TransportMethod,
} from '../transportMethod';

export type AttendanceDetailDrawerUser = {
  id: string;
  name: string;
};

export type AttendanceDetailDrawerVisit = {
  status: '未' | '通所中' | '退所済' | '当日欠席';
  transportTo?: boolean;
  transportFrom?: boolean;
  transportToMethod?: TransportMethod;
  transportFromMethod?: TransportMethod;
  transportToNote?: string;
  transportFromNote?: string;
  actualService?: string;
  billing?: string;
  isUserConfirmed?: boolean;
  absentMorningContacted?: boolean;
  eveningChecked?: boolean;
  isAbsenceAddonClaimable?: boolean;
  absenceLimitReached?: boolean;
};

export type AttendanceDetailDrawerProps = {
  open: boolean;
  user: AttendanceDetailDrawerUser | null;
  visit: AttendanceDetailDrawerVisit | null;
  onClose: () => void;
  /** @deprecated use onTransportToMethodChange instead */
  onTransportToChange?: (value: boolean) => void;
  /** @deprecated use onTransportFromMethodChange instead */
  onTransportFromChange?: (value: boolean) => void;
  onTransportToMethodChange?: (method: TransportMethod) => void;
  onTransportFromMethodChange?: (method: TransportMethod) => void;
  onUserConfirm?: () => void;
  onReset?: () => void;
  onViewHandoff?: () => void;
};

export function AttendanceDetailDrawer({
  open,
  user,
  visit,
  onClose,
  onTransportToChange,
  onTransportFromChange,
  onTransportToMethodChange,
  onTransportFromMethodChange,
  onUserConfirm,
  onReset,
  onViewHandoff,
}: AttendanceDetailDrawerProps): JSX.Element {
  if (!user || !visit) {
    return <Drawer anchor="right" open={false} onClose={onClose} />;
  }

  const isAbsent = visit.status === '当日欠席';

  // Resolve displayed method: method field > boolean fallback
  const toMethod: TransportMethod =
    visit.transportToMethod ?? (visit.transportTo ? 'office_shuttle' : 'self');
  const fromMethod: TransportMethod =
    visit.transportFromMethod ?? (visit.transportFrom ? 'office_shuttle' : 'self');

  const handleToMethodChange = (e: SelectChangeEvent<string>) => {
    const method = e.target.value as TransportMethod;
    onTransportToMethodChange?.(method);
    // Legacy boolean callback for backward compat
    onTransportToChange?.(method === 'office_shuttle');
  };

  const handleFromMethodChange = (e: SelectChangeEvent<string>) => {
    const method = e.target.value as TransportMethod;
    onTransportFromMethodChange?.(method);
    // Legacy boolean callback for backward compat
    onTransportFromChange?.(method === 'office_shuttle');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 }, p: 2 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {user.name}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {isAbsent ? (
          <>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>欠席対応</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  label={`朝連絡 ${visit.absentMorningContacted ? '済' : '未'}`}
                  color={visit.absentMorningContacted ? 'success' : 'default'}
                  variant={visit.absentMorningContacted ? 'filled' : 'outlined'}
                />
                <Chip
                  label={`夕方様子 ${visit.eveningChecked ? '済' : '未'}`}
                  color={visit.eveningChecked ? 'success' : 'default'}
                  variant={visit.eveningChecked ? 'filled' : 'outlined'}
                />
                {visit.isAbsenceAddonClaimable ? (
                  <Chip label="欠席加算対象" color="warning" />
                ) : null}
                {visit.absenceLimitReached && visit.isAbsenceAddonClaimable === false ? (
                  <Chip label="上限超過のため請求対象外" color="default" variant="outlined" />
                ) : null}
              </Box>
            </Box>
            <Divider />
          </>
        ) : null}
        {/* 送迎 */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DirectionsCarIcon fontSize="small" />
            送迎手段
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 1 }}>
            <FormControl size="small" fullWidth disabled={isAbsent}>
              <InputLabel id="transport-to-label">行き</InputLabel>
              <Select
                labelId="transport-to-label"
                value={toMethod}
                label="行き"
                onChange={handleToMethodChange}
              >
                {TRANSPORT_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {TRANSPORT_METHOD_LABEL[m]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={isAbsent}>
              <InputLabel id="transport-from-label">帰り</InputLabel>
              <Select
                labelId="transport-from-label"
                value={fromMethod}
                label="帰り"
                onChange={handleFromMethodChange}
              >
                {TRANSPORT_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {TRANSPORT_METHOD_LABEL[m]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Divider />

        {/* 実提供 / 算定 */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>実提供 / 算定</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {visit.actualService ? (
              <Chip label={`実提供: ${visit.actualService}`} variant="outlined" />
            ) : (
              <Chip label="実提供: 未設定" variant="outlined" color="default" />
            )}
            {visit.billing ? (
              <Chip label={`算定: ${visit.billing}`} color="primary" />
            ) : (
              <Chip label="算定: 未設定" variant="outlined" color="default" />
            )}
          </Box>
        </Box>

        <Divider />

        {/* 利用者確認 */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>利用者確認</Typography>
          <Button
            variant={visit.isUserConfirmed ? 'outlined' : 'contained'}
            color={visit.isUserConfirmed ? 'success' : 'primary'}
            fullWidth
            disabled={isAbsent}
            onClick={onUserConfirm}
            sx={{ justifyContent: 'flex-start', minHeight: 44 }}
          >
            {visit.isUserConfirmed ? '✓ 確認済み' : '確認する'}
          </Button>
        </Box>

        {/* 申し送り */}
        {onViewHandoff ? (
          <>
            <Divider />
            <Box>
              <Button
                variant="text"
                fullWidth
                onClick={onViewHandoff}
                sx={{ justifyContent: 'flex-start', minHeight: 44 }}
              >
                申し送りを見る →
              </Button>
            </Box>
          </>
        ) : null}

        {/* 危険操作 */}
        {onReset ? (
          <>
            <Divider />
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ErrorOutlineIcon fontSize="small" color="error" />
                危険操作
              </Typography>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={onReset}
                sx={{ justifyContent: 'flex-start', minHeight: 44 }}
              >
                リセット（全ての打刻を削除）
              </Button>
            </Box>
          </>
        ) : null}
      </Box>
    </Drawer>
  );
}
