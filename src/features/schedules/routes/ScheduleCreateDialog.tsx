import {
    Close as CloseIcon,
    DeleteOutline as DeleteOutlineIcon,
    EventAvailable as EventIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import React, { useState } from 'react';

import { TESTIDS } from '@/testids';
import type {
    CreateScheduleEventInput,
    ScheduleServiceType,
    ScheduleStatus
} from '../data';
import {
    scheduleCategoryLabels,
    scheduleFacilityHelpText
} from '../domain/categoryLabels';
import {
    LIVING_SUPPORT_SERVICE_TYPE_OPTIONS,
    SERVICE_TYPE_OPTIONS,
    type ScheduleFormState,
    type ScheduleUserOption,
} from '../domain/scheduleFormState';
import type { OrgOption } from '../hooks/useOrgOptions';
import { useScheduleCreateForm } from '../hooks/useScheduleCreateForm';
import { SCHEDULE_STATUS_OPTIONS } from '../statusMetadata';

// ===== Types for Dialog Component Only =====
// (All business logic types moved to scheduleFormState.ts for Fast Refresh compatibility)
// (All state management moved to useScheduleCreateForm hook for A/B layer separation)

type ScheduleCreateDialogBaseProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleEventInput) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  users: ScheduleUserOption[];
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  defaultUser?: ScheduleUserOption | null;
  dialogTestId?: string;
  submitTestId?: string;
  isSubmitting?: boolean;
  isDeleting?: boolean;
};

type ScheduleCreateDialogCreateProps = {
  mode: 'create';
  eventId?: undefined;
  initialOverride?: Partial<ScheduleFormState> | null;
};

type ScheduleCreateDialogEditProps = {
  mode: 'edit';
  eventId: string;
  initialOverride?: Partial<ScheduleFormState> | null;
};

export type ScheduleCreateDialogProps = ScheduleCreateDialogBaseProps & (ScheduleCreateDialogCreateProps | ScheduleCreateDialogEditProps);

// ===== Component-local Helpers =====

const CATEGORY_OPTIONS: { value: string; label: string; helper: string }[] = [
  { value: 'User', label: scheduleCategoryLabels.User, helper: '利用者予定：利用者とサービス種別を指定' },
  { value: 'LivingSupport', label: scheduleCategoryLabels.LivingSupport, helper: '生活支援：一時ケア・ショートステイ・会議等' },
  { value: 'Staff', label: scheduleCategoryLabels.Staff, helper: '職員予定：担当職員を選択' },
  { value: 'Org', label: scheduleCategoryLabels.Org, helper: `施設予定：${scheduleFacilityHelpText}` },
];

const FACILITY_ONE_TIME_GUIDE = '施設レーンは「会議・全体予定・共有タスク」用です。';

// ===== Component =====

export const ScheduleCreateDialog: React.FC<ScheduleCreateDialogProps> = (props) => {
  const {
    onDelete,
    users,
    mode,
    eventId,
    submitTestId,
  } = props;

  const vm = useScheduleCreateForm(props);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <>
    <Dialog
      open={props.open}
      onClose={vm.handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': vm.headingId,
        'aria-describedby': vm.dialogAriaDescribedBy,
        'data-testid': vm.resolvedDialogTestId,
      }}
    >
      <Box data-testid={TESTIDS['schedule-editor-root']} sx={{ display: 'contents' }}>
      <DialogTitle
        id={vm.headingId}
        data-testid={TESTIDS['schedule-create-heading']}
        sx={{ pb: 1 }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <EventIcon />
          {vm.titleLabel}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography
          id={vm.descriptionId}
          data-testid={TESTIDS['schedule-create-description']}
          variant="body2"
          color="textSecondary"
          sx={{ mb: 2 }}
        >
          タイトル、開始/終了時刻、カテゴリと対象を入力して{mode === 'edit' ? '内容を更新' : '新しい予定を登録'}します。
        </Typography>

        {vm.showFacilityGuide ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {FACILITY_ONE_TIME_GUIDE}
          </Alert>
        ) : null}

        <Stack spacing={2}>
          {vm.errors.length > 0 && (
            <Alert
              severity="error"
              data-testid={TESTIDS['schedule-create-error-alert']}
              id={vm.errorSummaryId}
            >
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {vm.errors.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </Alert>
          )}

          <TextField
            label="予定タイトル"
            required
            fullWidth
            value={vm.form.title}
            onChange={(e) => vm.handleFieldChange('title', e.target.value)}
            placeholder={vm.titlePlaceholder}
            helperText={vm.titleHelperText}
            inputRef={vm.titleInputRef}
            inputProps={{
              'data-testid': TESTIDS['schedule-create-title'],
            }}
          />

          <FormControl fullWidth required>
            <InputLabel id="schedule-create-category-label">カテゴリ</InputLabel>
            <Select
              labelId="schedule-create-category-label"
              label="カテゴリ"
              value={vm.form.category}
              onChange={vm.handleCategoryChange}
              data-testid={TESTIDS['schedule-create-category-select']}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack spacing={0.25}>
                    <span>{option.label}</span>
                    <Typography variant="caption" color="text.secondary">
                      {option.helper}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {vm.form.category === 'User' && (
            <Autocomplete
              options={users}
              value={vm.selectedUser}
              onChange={vm.handleUserChange}
              getOptionLabel={option => option.name}
              renderInput={params => (
                <TextField
                  {...params}
                  label="利用者"
                  required
                  inputRef={vm.userInputRef}
                  inputProps={{
                    ...params.inputProps,
                    'data-testid': TESTIDS['schedule-create-user-input']
                  }}
                />
              )}
            />
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="datetime-local"
              label="開始日時"
              required
              fullWidth
              value={vm.form.startLocal}
              onChange={e => vm.handleFieldChange('startLocal', e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                'data-testid': TESTIDS['schedule-create-start']
              }}
            />

            <TextField
              type="datetime-local"
              label="終了日時"
              required
              fullWidth
              value={vm.form.endLocal}
              onChange={e => vm.handleFieldChange('endLocal', e.target.value)}
              InputLabelProps={{ shrink: true }}
              error={Boolean(vm.dateOrderErrorMessage)}
              helperText={vm.dateOrderErrorMessage}
              inputProps={{
                'data-testid': TESTIDS['schedule-create-end']
              }}
            />
          </Stack>

          {(vm.form.category === 'User' || vm.form.category === 'LivingSupport') && (
            <FormControl fullWidth required error={Boolean(vm.serviceTypeErrorMessage)}>
              <InputLabel id="schedule-create-service-type-label">サービス種別</InputLabel>
              <Select
                labelId="schedule-create-service-type-label"
                label="サービス種別"
                value={vm.form.serviceType || ''}
                onChange={e =>
                  vm.handleFieldChange('serviceType', e.target.value as ScheduleServiceType | '')
                }
                inputProps={{ 'aria-label': 'サービス種別' }}
                data-testid={TESTIDS['schedule-create-service-type']}
              >
                {(vm.form.category === 'LivingSupport'
                  ? LIVING_SUPPORT_SERVICE_TYPE_OPTIONS
                  : SERVICE_TYPE_OPTIONS
                ).map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {vm.serviceTypeErrorMessage ?? 'サービス種別を付けておくと一覧で絞り込みやすくなります。'}
              </FormHelperText>
            </FormControl>
          )}

          {vm.form.category === 'Org' ? (
            <Autocomplete<OrgOption, false, false, true>
              freeSolo
              options={vm.orgOptions}
              value={vm.selectedOrgOption ?? (vm.form.locationName ? vm.form.locationName : null)}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  vm.handleFieldChange('locationName', value);
                  return;
                }
                vm.handleFieldChange('locationName', value?.label ?? '');
              }}
              onInputChange={(_, value, reason) => {
                if (reason === 'input') {
                  vm.handleFieldChange('locationName', value);
                }
                if (reason === 'clear') {
                  vm.handleFieldChange('locationName', '');
                }
              }}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
              isOptionEqualToValue={(option, value) =>
                typeof value === 'string' ? option.label === value : option.id === value.id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="対象 / 場所（任意）"
                  placeholder="施設イベントの対象を選択"
                  inputProps={{
                    ...params.inputProps,
                    'data-testid': TESTIDS['schedule-create-location'],
                  }}
                />
              )}
            />
          ) : (
            <TextField
              label="場所"
              fullWidth
              value={vm.form.locationName}
              onChange={e => vm.handleFieldChange('locationName', e.target.value)}
              placeholder="例）活動室A／送迎車／会議室 など"
              inputProps={{
                'data-testid': TESTIDS['schedule-create-location']
              }}
            />
          )}

          <TextField
            label="メモ"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={vm.form.notes}
            onChange={e => vm.handleFieldChange('notes', e.target.value)}
            placeholder="支援のポイントや、共有したい補足を記入"
            inputProps={{
              'data-testid': TESTIDS['schedule-create-notes']
            }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {vm.form.category === 'User' ? (
              <Autocomplete
                options={vm.staffOptions}
                value={vm.selectedStaffOption}
                onChange={vm.handleStaffChange}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="職員を選択"
                    required
                    inputRef={vm.staffInputRef}
                    inputProps={{
                      ...params.inputProps,
                      'data-testid': TESTIDS['schedule-create-staff-id'],
                    }}
                  />
                )}
              />
            ) : (
              <TextField
                label="担当職員 ID（任意）"
                type="number"
                fullWidth
                value={vm.form.assignedStaffId}
                onChange={(e) => vm.handleFieldChange('assignedStaffId', e.target.value)}
                placeholder="SharePoint の AssignedStaffId"
                inputRef={vm.staffInputRef}
                inputProps={{
                  min: 0,
                  'data-testid': TESTIDS['schedule-create-staff-id'],
                }}
              />
            )}

            <TextField
              label="車両 ID（任意）"
              type="number"
              fullWidth
              value={vm.form.vehicleId}
              onChange={(e) => vm.handleFieldChange('vehicleId', e.target.value)}
              placeholder="SharePoint の VehicleId"
              inputProps={{
                min: 0,
                'data-testid': TESTIDS['schedule-create-vehicle-id'],
              }}
            />
          </Stack>

          {mode === 'edit' && (
            <Box mt={1}
              sx={{ borderTop: '1px solid rgba(0,0,0,0.08)', pt: 2 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                ステータス
              </Typography>
              <RadioGroup
                row
                value={vm.form.status}
                onChange={(e) => vm.handleFieldChange('status', e.target.value as ScheduleStatus)}
                aria-label="ステータス選択"
              >
                {SCHEDULE_STATUS_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
              <TextField
                margin="dense"
                fullWidth
                label="ステータスの理由（任意）"
                value={vm.form.statusReason}
                onChange={(e) => vm.handleFieldChange('statusReason', e.target.value)}
                placeholder="例：本人の体調不良のため延期など"
                multiline
                minRows={2}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        {mode === 'edit' && eventId && onDelete && (
          <Button
            onClick={() => setDeleteConfirmOpen(true)}
            startIcon={<DeleteOutlineIcon />}
            color="error"
            disabled={vm.submitting || vm.externalIsDeleting}
          >
            {vm.externalIsDeleting ? (
              <>
                <span>削除中…</span>
                <CircularProgress size={16} sx={{ ml: 1 }} />
              </>
            ) : (
              '削除'
            )}
          </Button>
        )}
        <Button onClick={vm.handleClose} startIcon={<CloseIcon />} disabled={vm.submitting || vm.externalIsSubmitting}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={vm.handleSubmit}
          startIcon={<SaveIcon />}
          disabled={vm.submitting || vm.externalIsSubmitting}
          data-testid={submitTestId ?? TESTIDS['schedule-create-save']}
        >
            {vm.submitting || vm.externalIsSubmitting ? '保存中...' : vm.primaryButtonLabel}
        </Button>
      </DialogActions>
      </Box>
    </Dialog>

    {/* 削除確認ダイアログ */}
    {mode === 'edit' && eventId && onDelete && (
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        aria-labelledby="schedule-delete-confirm-title"
      >
        <DialogTitle id="schedule-delete-confirm-title">予定の削除</DialogTitle>
        <DialogContent>
          <Typography>
            この予定を削除します。よろしいですか？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} autoFocus>
            キャンセル
          </Button>
          <Button
            onClick={async () => {
              setDeleteConfirmOpen(false);
              try {
                await onDelete(eventId);
                props.onClose();
              } catch (error) {
                console.error('Failed to delete schedule:', error);
              }
            }}
            color="error"
            variant="contained"
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    )}
    </>
  );
};

export default ScheduleCreateDialog;
