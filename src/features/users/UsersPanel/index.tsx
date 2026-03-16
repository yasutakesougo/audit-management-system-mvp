/**
 * UsersPanel
 *
 * 利用者管理パネルのオーケストレーター。
 * ロジックは useUsersPanel に集約し、
 * UIは UsersMenu / UsersList / UsersCreateForm に委譲する。
 *
 * 編集権限:
 *   - admin ロール: 常時編集可能
 *   - その他ロール: 閲覧のみ。管理者 PIN 入力で 30 分間編集可能（一時解除）
 */
import { useAdminOverride } from '@/auth/useAdminOverride';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { TESTIDS } from '@/testids';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import UserForm from '../UserForm';
import UsersCreateForm from './UsersCreateForm';
import UsersList from './UsersList';
import UsersMenu from './UsersMenu';
import { useUsersPanel, type UsersTab } from './useUsersPanel';

const UsersPanel = () => {
  const {
    data,
    status,
    errorMessage,
    activeTab,
    setActiveTab,
    detailUserKey,
    detailUser,
    detailSectionRef,
    busyId,
    isCreatePending,
    showCreateForm,
    showEditForm,
    selectedUser,
    setShowCreateForm,
    handleCreate,
    deleteConfirm,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleRefresh,
    handleDetailSelect,
    handleDetailClose,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
    handleExportAchievementPDF,
    handleExportMonthlySummary,
    integrityErrors,
    panelOpenButtonRef,
  } = useUsersPanel();

  const { role } = useUserAuthz();
  const isAdmin = role === 'admin';

  // 管理者承認による一時的な編集権限
  const { isOverrideActive, requestOverride, revokeOverride, remainingMs } = useAdminOverride();
  const canEdit = isAdmin || isOverrideActive;

  // PIN 入力ダイアログ
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  const handlePinSubmit = () => {
    const ok = requestOverride(pinValue);
    if (ok) {
      setPinDialogOpen(false);
      setPinValue('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handlePinDialogClose = () => {
    setPinDialogOpen(false);
    setPinValue('');
    setPinError(false);
  };

  const remainingMinutes = Math.ceil(remainingMs / 60_000);

  return (
    <Box sx={{ p: 3 }} data-testid={TESTIDS['users-panel-root']}>
      {/* 編集モード表示バナー */}
      {!isAdmin && isOverrideActive && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<LockRoundedIcon />}
              onClick={revokeOverride}
            >
              編集モード終了
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            編集モード有効（残り約 {remainingMinutes} 分）
          </Typography>
        </Alert>
      )}

      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as UsersTab)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="利用者タブメニュー"
          sx={{ px: 2, pt: 1 }}
        >
          <Tab value="menu" label="利用者メニュー" />
          <Tab
            value="list"
            label={`利用者一覧 (${data.length})`}
            iconPosition="start"
            icon={<PeopleAltRoundedIcon fontSize="small" />}
          />
          {canEdit && (
            <Tab
              value="create"
              label="新規利用者登録"
              iconPosition="start"
              icon={<PersonAddRoundedIcon fontSize="small" />}
            />
          )}
        </Tabs>
        <Divider />
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          {activeTab === 'menu' && (
            <UsersMenu
              onNavigateToList={() => setActiveTab('list')}
              onNavigateToCreate={() => setActiveTab('create')}
              onExportMonthlySummary={handleExportMonthlySummary}
            />
          )}
          {activeTab === 'list' && (
            <>
              <UsersList
                users={data}
                status={status}
                busyId={busyId}
                selectedUserKey={detailUserKey}
                detailUser={detailUser}
                detailSectionRef={detailSectionRef}
                errorMessage={errorMessage}
                onRefresh={handleRefresh}
                onDelete={canEdit ? (id: number | string) => {
                  const user = data.find((u) => u.Id === Number(id));
                  handleDeleteRequest(id, user?.FullName ?? undefined);
                } : undefined}
                onEdit={canEdit ? handleEditClick : undefined}
                onSelectDetail={handleDetailSelect}
                onCloseDetail={handleDetailClose}
                onExportPDF={handleExportAchievementPDF}
                integrityErrors={integrityErrors}
              />
              {/* 編集モード解除ボタン（非 admin 向け） */}
              {!isAdmin && !isOverrideActive && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => setPinDialogOpen(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    編集モードに切り替え（管理者承認が必要）
                  </Button>
                </Box>
              )}
            </>
          )}
          {canEdit && activeTab === 'create' && (
            <UsersCreateForm
              isSubmitting={isCreatePending}
              onCreate={handleCreate}
              onOpenDetailForm={() => setShowCreateForm(true)}
            />
          )}
        </Box>
      </Paper>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <button
          type="button"
          ref={panelOpenButtonRef}
          data-testid={TESTIDS['users-panel-open']}
          onClick={() => setActiveTab('list')}
          style={{ display: 'none' }}
          aria-label="利用者一覧を開く"
        >
          <ChevronRightRoundedIcon />
        </button>
      </Box>

      <Dialog
        open={showCreateForm}
        onClose={handleCloseForm}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={false}
        disableAutoFocus={false}
        disableEnforceFocus={false}
        disableRestoreFocus={false}
      >
        <DialogContent sx={{ p: 0 }}>
          <UserForm
            mode="create"
            onSuccess={handleCreateFormSuccess}
            onClose={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditForm}
        onClose={handleCloseForm}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={false}
        disableAutoFocus={false}
        disableEnforceFocus={false}
        disableRestoreFocus={false}
      >
        <DialogContent sx={{ p: 0 }}>
          <UserForm
            user={selectedUser || undefined}
            mode="update"
            onSuccess={handleEditFormSuccess}
            onClose={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* 管理者 PIN 入力ダイアログ */}
      <Dialog
        open={pinDialogOpen}
        onClose={handlePinDialogClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockOpenRoundedIcon color="warning" />
            <Typography variant="h6" component="span">管理者承認</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            編集モードに切り替えるには、管理者の PIN を入力してください。
            承認後 30 分間、編集・新規登録が可能になります。
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="管理者 PIN"
            type="password"
            value={pinValue}
            onChange={(e) => {
              setPinValue(e.target.value);
              setPinError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePinSubmit();
            }}
            error={pinError}
            helperText={pinError ? 'PIN が正しくありません' : ''}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handlePinDialogClose} color="inherit">
            キャンセル
          </Button>
          <Button
            onClick={handlePinSubmit}
            variant="contained"
            color="warning"
            disabled={!pinValue.trim()}
          >
            承認
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteConfirm.open}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteRoundedIcon color="error" />
          <Typography variant="h6" component="span">利用者の削除</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {deleteConfirm.targetName
              ? `「${deleteConfirm.targetName}」を削除しますか？`
              : 'この利用者を削除しますか？'}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
            削除した利用者はSharePointのごみ箱に移動されます。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDeleteCancel} color="inherit">
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            startIcon={<DeleteRoundedIcon />}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPanel;
