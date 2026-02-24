/**
 * UsersPanel
 *
 * 利用者管理パネルのオーケストレーター。
 * ロジックは useUsersPanel に集約し、
 * UIは UsersMenu / UsersList / UsersCreateForm に委譲する。
 */
import { TESTIDS } from '@/testids';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
    handleDelete,
    handleRefresh,
    handleDetailSelect,
    handleDetailClose,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
    panelOpenButtonRef,
  } = useUsersPanel();

  return (
    <Box sx={{ p: 3 }} data-testid={TESTIDS['users-panel-root']}>
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
          <Tab
            value="create"
            label="新規利用者登録"
            iconPosition="start"
            icon={<PersonAddRoundedIcon fontSize="small" />}
          />
        </Tabs>
        <Divider />
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          {activeTab === 'menu' && (
            <UsersMenu
              onNavigateToList={() => setActiveTab('list')}
              onNavigateToCreate={() => setActiveTab('create')}
            />
          )}
          {activeTab === 'list' && (
            <UsersList
              users={data}
              status={status}
              busyId={busyId}
              selectedUserKey={detailUserKey}
              detailUser={detailUser}
              detailSectionRef={detailSectionRef}
              errorMessage={errorMessage}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
              onEdit={handleEditClick}
              onSelectDetail={handleDetailSelect}
              onCloseDetail={handleDetailClose}
            />
          )}
          {activeTab === 'create' && (
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
    </Box>
  );
};

export default UsersPanel;
