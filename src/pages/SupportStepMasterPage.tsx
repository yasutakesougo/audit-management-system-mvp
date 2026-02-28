import { useUsersDemo } from '@/features/users/usersStoreDemo';
import AddIcon from '@mui/icons-material/Add';
import TemplatesIcon from '@mui/icons-material/LibraryBooks';
import ListAltIcon from '@mui/icons-material/ListAlt';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { SupportStepTemplate } from '../domain/support/step-templates';
import { IBDPageHeader } from '../features/ibd/components/IBDPageHeader';
import { SupportStepTemplateForm } from '../features/support/SupportStepTemplateForm';
import { SupportStepTemplateList } from '../features/support/SupportStepTemplateList';
import { useSupportStepTemplates } from '../features/support/hooks/useSupportStepTemplates';

// ─── TabPanel ────────────────────────────────────────────
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `template-tab-${index}`,
    'aria-controls': `template-tabpanel-${index}`,
  };
}

// ─── Page ────────────────────────────────────────────────
const SupportStepMasterPage: React.FC = () => {
  // ── 利用者選択 ──
  const { data: users } = useUsersDemo();
  const [selectedUserCode, setSelectedUserCode] = useState<string>('');

  // ── SP テンプレート取得 + Mutation ──
  const {
    templates, spTemplates, isLoading, isMutating, error,
    createTemplate, updateTemplate, deleteTemplate,
  } = useSupportStepTemplates(selectedUserCode || null);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState<SupportStepTemplate | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
    setActiveTab(1);
  };

  const handleEditTemplate = (template: SupportStepTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
    setActiveTab(1);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (templateId.startsWith('default-')) {
      setNotification({ open: true, message: 'デフォルトテンプレートは削除できません', severity: 'warning' });
      return;
    }

    const ok = await deleteTemplate(templateId);
    setNotification({
      open: true,
      message: ok ? 'テンプレートを削除しました' : 'テンプレート削除に失敗しました',
      severity: ok ? 'success' : 'error',
    });
  };

  const handleSaveTemplate = async (template: SupportStepTemplate) => {
    if (editingTemplate) {
      if (template.id.startsWith('default-') || template.isDefault) {
        setNotification({ open: true, message: 'デフォルトテンプレートは編集できません', severity: 'warning' });
        return;
      }
      const ok = await updateTemplate(template);
      setNotification({
        open: true,
        message: ok ? 'テンプレートを更新しました' : '更新に失敗しました',
        severity: ok ? 'success' : 'error',
      });
    } else {
      if (!selectedUserCode) {
        setNotification({ open: true, message: '利用者を選択してください', severity: 'warning' });
        return;
      }
      const ok = await createTemplate(template);
      setNotification({
        open: true,
        message: ok ? 'テンプレートを作成しました' : '作成に失敗しました',
        severity: ok ? 'success' : 'error',
      });
    }

    setIsFormOpen(false);
    setEditingTemplate(null);
    setActiveTab(0);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setActiveTab(0);
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // ── 利用者セレクタ ──
  const userSelector = (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="step-template-user-label">利用者</InputLabel>
      <Select
        labelId="step-template-user-label"
        value={selectedUserCode}
        label="利用者"
        onChange={(e) => setSelectedUserCode(e.target.value)}
        data-testid="step-template-user-select"
      >
        <MenuItem value="">
          <em>デフォルトのみ</em>
        </MenuItem>
        {users.map((user) => (
          <MenuItem key={user.UserID} value={user.UserID}>
            {user.FullName}（{user.UserID}）
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <Box>
      {/* ── IBDPageHeader ── */}
      <IBDPageHeader
        title="支援手順マスタ"
        subtitle="利用者ごとの個別支援手順を管理します"
        icon={<ListAltIcon />}
        actions={
          <Box display="flex" gap={2} alignItems="center">
            {userSelector}
            {!isFormOpen && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddTemplate}
                disabled={isMutating}
                data-testid="support-step-templates-add-button"
              >
                新規作成
              </Button>
            )}
          </Box>
        }
      />

      {/* ── エラー表示 ── */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── SP テンプレート件数バッジ ── */}
      {selectedUserCode && !isLoading && (
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          <Typography variant="body2">
            <strong>{users.find((u) => u.UserID === selectedUserCode)?.FullName}</strong> さんの
            支援手順: <strong>{spTemplates.length}</strong> 件（SharePoint）
            + デフォルト 7 件
          </Typography>
        </Alert>
      )}

      {/* ── メインコンテンツ ── */}
      <Paper elevation={1}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="支援手順テンプレート管理タブ"
            data-testid="support-step-templates-tabs"
          >
            <Tab
              icon={<TemplatesIcon />}
              label="テンプレート一覧"
              iconPosition="start"
              {...a11yProps(0)}
              data-testid="support-step-templates-tab-list"
            />
            {isFormOpen && (
              <Tab
                icon={<AddIcon />}
                label={editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
                iconPosition="start"
                {...a11yProps(1)}
                data-testid="support-step-templates-tab-form"
              />
            )}
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {isLoading ? (
            <Box textAlign="center" py={8}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                SharePoint からテンプレートを取得中...
              </Typography>
            </Box>
          ) : templates.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" mb={2}>
                テンプレートがありません
              </Typography>
              <Typography variant="body1" color="text.disabled" mb={3}>
                利用者を選択するか、新しいテンプレートを作成してください
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddTemplate}>
                テンプレート作成
              </Button>
            </Box>
          ) : (
            <SupportStepTemplateList
              templates={templates}
              onEdit={handleEditTemplate}
              onDelete={handleDeleteTemplate}
              onAdd={handleAddTemplate}
            />
          )}
        </TabPanel>

        {isFormOpen && (
          <TabPanel value={activeTab} index={1}>
            <SupportStepTemplateForm
              template={editingTemplate || undefined}
              onSave={handleSaveTemplate}
              onCancel={handleCancelForm}
              isEditing={!!editingTemplate}
            />
          </TabPanel>
        )}
      </Paper>

      {/* ── 通知 ── */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} variant="filled">
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SupportStepMasterPage;
