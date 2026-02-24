/**
 * UserForm
 *
 * 利用者マスタの作成・編集フォーム。
 *
 * このファイルはレイアウト・構造のみを担う薄いオーケストレーター。
 * フォームロジック → useUserForm.ts
 * 各フィールドグループ → components/FormSections/
 */
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Paper,
    Snackbar,
    Typography,
} from '@mui/material';
import type { IUserMaster } from '../../sharepoint/fields';
import { BasicInfoSection } from './components/FormSections/BasicInfoSection';
import { BillingSection } from './components/FormSections/BillingSection';
import { ContractSection } from './components/FormSections/ContractSection';
import { TransportAdditionSection } from './components/FormSections/TransportAdditionSection';
import { useUserForm } from './useUserForm';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type UserFormProps = {
  user?: IUserMaster;
  mode?: 'create' | 'update';
  onSuccess?: (user: IUserMaster) => void;
  onDone?: (user: IUserMaster) => void;
  onClose?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserForm({
  user,
  mode = user ? 'update' : 'create',
  onSuccess,
  onDone,
  onClose,
}: UserFormProps) {
  const {
    values,
    errors,
    isSaving,
    message,
    showConfirmDialog,
    formRef,
    errRefs,
    setField,
    toggleDay,
    handleSupportTargetToggle,
    handleClose,
    handleSubmit,
    setMessage,
    setShowConfirmDialog,
  } = useUserForm(user, mode, { onSuccess, onDone, onClose });

  const systemAssignedCode =
    mode === 'create' ? '保存後に自動採番されます' : (user?.UserID ?? '未採番');

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
      {/* ヘッダー */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" component="h2">
            {mode === 'create' ? '新規利用者登録' : '利用者情報編集'}
          </Typography>
        </Box>
        {onClose && (
          <IconButton
            onClick={handleClose}
            size="small"
            aria-label="フォームを閉じる"
            tabIndex={0}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* フォーム本体 */}
      <form
        ref={formRef}
        data-form="user"
        onSubmit={handleSubmit}
        role="form"
        aria-label={mode === 'create' ? '新規利用者登録フォーム' : '利用者情報編集フォーム'}
      >
        {/* ステータスメッセージ */}
        {message && (
          <Alert
            severity={message.type === 'success' ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        {/* 基本情報 */}
        <BasicInfoSection
          values={values}
          errors={errors}
          setField={setField}
          toggleDay={toggleDay}
          systemAssignedCode={systemAssignedCode}
          errRefs={errRefs}
        />

        {/* 契約・サービス情報 + 支給決定情報 */}
        <ContractSection
          values={values}
          errors={errors}
          setField={setField}
          toggleDay={toggleDay}
        />

        {/* 受給者証・負担情報（請求セクションの一部） */}
        <BillingSection
          values={values}
          errors={errors}
          setField={setField}
          toggleDay={toggleDay}
          certNumberRef={errRefs.certNumber}
        />

        {/* 送迎・通所情報 + 支援区分 + 加算情報 */}
        <TransportAdditionSection
          values={values}
          errors={errors}
          setField={setField}
          toggleDay={toggleDay}
          handleSupportTargetToggle={handleSupportTargetToggle}
        />

        {/* アクションボタン */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={{ minWidth: 120 }}
            tabIndex={0}
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
              tabIndex={0}
            >
              閉じる
            </Button>
          )}
        </Box>

        {/* 成功 Snackbar */}
        <Snackbar
          open={message?.type === 'success'}
          autoHideDuration={3000}
          onClose={() => setMessage(null)}
        >
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message?.text}
          </Alert>
        </Snackbar>

        {/* 未保存変更の確認ダイアログ */}
        <Dialog
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          maxWidth="sm"
        >
          <DialogTitle>未保存の変更があります</DialogTitle>
          <DialogContent>
            <DialogContentText>
              フォームに未保存の変更があります。保存せずに閉じますか？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowConfirmDialog(false)}>キャンセル</Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                onClose?.();
              }}
              color="error"
            >
              閉じる
            </Button>
          </DialogActions>
        </Dialog>
      </form>
    </Paper>
  );
}

export default UserForm;
