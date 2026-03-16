import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    Paper,
    Snackbar,
} from '@mui/material';

import { TESTIDS } from '@/testids';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StaffFormBasicInfoSection } from './components/StaffFormBasicInfoSection';
import { StaffFormCertSection } from './components/StaffFormCertSection';
import { StaffFormContactSection } from './components/StaffFormContactSection';
import { StaffFormHeader } from './components/StaffFormHeader';
import { StaffFormShiftSection } from './components/StaffFormShiftSection';
import { StaffFormWorkDaysSection } from './components/StaffFormWorkDaysSection';
import type { StaffFormProps } from './domain/staffFormDomain';
import { useStaffForm } from './useStaffForm';

export function StaffForm(props: StaffFormProps) {
  const { staff, mode = staff ? 'update' : 'create', onClose } = props;

  const {
    values,
    errors,
    isSaving,
    message,
    customCertification,
    formRef,
    errRefs,
    setMessage,
    setCustomCertification,
    setField,
    toggleWorkDay,
    toggleBaseWorkingDay,
    toggleCertification,
    removeCertification,
    handleAddCustomCertification,
    handleClose,
    handleSubmit,
    closeConfirmDialog,
  } = useStaffForm(props);

  return (
    <>
    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }} data-testid={TESTIDS['staff-form-root']}>
      <StaffFormHeader mode={mode} onClose={onClose} handleClose={handleClose} />

      <form ref={formRef} data-form="staff" onSubmit={handleSubmit} noValidate>
        {/* Status Messages */}
        {message && (
          <Alert
            severity={message.type === 'success' ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        <StaffFormBasicInfoSection
          values={values}
          errors={errors}
          errRefs={errRefs}
          setField={setField}
        />

        <StaffFormContactSection
          values={values}
          errors={errors}
          errRefs={errRefs}
          setField={setField}
        />

        <StaffFormShiftSection
          values={values}
          errors={errors}
          errRefs={errRefs}
          setField={setField}
          toggleBaseWorkingDay={toggleBaseWorkingDay}
        />

        <StaffFormWorkDaysSection values={values} toggleWorkDay={toggleWorkDay} />

        <StaffFormCertSection
          values={values}
          customCertification={customCertification}
          setCustomCertification={setCustomCertification}
          toggleCertification={toggleCertification}
          removeCertification={removeCertification}
          handleAddCustomCertification={handleAddCustomCertification}
        />

        {/* 在籍ステータス */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={values.IsActive}
                onChange={(event) => setField('IsActive', event.target.checked)}
              />
            }
            label="在籍中"
          />
        </Box>

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{ minWidth: 120 }}
            data-testid={TESTIDS['staff-form-submit']}
          >
            {mode === 'create' ? '作成' : '保存'}
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outlined"
              onClick={handleClose}
              disabled={isSaving}
              startIcon={<CloseIcon />}
              data-testid={TESTIDS['staff-form-close']}
            >
              閉じる
            </Button>
          )}
        </Box>

        {/* Success Snackbar */}
        <Snackbar
          open={message?.type === 'success'}
          autoHideDuration={3000}
          onClose={() => setMessage(null)}
        >
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message?.text}
          </Alert>
        </Snackbar>
      </form>
    </Paper>
    <ConfirmDialog {...closeConfirmDialog} />
    </>
  );
}

export default StaffForm;
