import {
    Add as AddIcon,
    LibraryBooks as TemplatesIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Paper,
    Snackbar,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { SupportStepTemplate, defaultSupportStepTemplates } from '../domain/support/step-templates';
import { SupportStepTemplateForm } from '../features/support/SupportStepTemplateForm';
import { SupportStepTemplateList } from '../features/support/SupportStepTemplateList';

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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `template-tab-${index}`,
    'aria-controls': `template-tabpanel-${index}`,
  };
}

const SupportStepMasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<SupportStepTemplate[]>([]);
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

  // デフォルトテンプレートとカスタムテンプレートを統合
  const allTemplates = useMemo(() => {
    const defaultTemplatesWithIds: SupportStepTemplate[] = defaultSupportStepTemplates.map((template, index) => ({
      ...template,
      id: `default-${index + 1}`
    }));
    return [...defaultTemplatesWithIds, ...templates];
  }, [templates]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
    setActiveTab(1); // フォームタブに切り替え
  };

  const handleEditTemplate = (template: SupportStepTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
    setActiveTab(1); // フォームタブに切り替え
  };

  const handleDeleteTemplate = (templateId: string) => {
    // デフォルトテンプレートは削除不可
    if (templateId.startsWith('default-')) {
      setNotification({
        open: true,
        message: 'デフォルトテンプレートは削除できません',
        severity: 'warning',
      });
      return;
    }

    setTemplates(prev => prev.filter(template => template.id !== templateId));
    setNotification({
      open: true,
      message: 'テンプレートを削除しました',
      severity: 'success',
    });
  };

  const handleSaveTemplate = (template: SupportStepTemplate) => {
    if (editingTemplate) {
      // 既存テンプレートの編集
      if (template.id.startsWith('default-')) {
        // デフォルトテンプレートは編集不可
        setNotification({
          open: true,
          message: 'デフォルトテンプレートは編集できません',
          severity: 'warning',
        });
        return;
      }

      setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
      setNotification({
        open: true,
        message: 'テンプレートを更新しました',
        severity: 'success',
      });
    } else {
      // 新規テンプレートの追加
      const newTemplate = {
        ...template,
        id: `custom-${Date.now()}`, // カスタムテンプレートのIDを生成
      };
      setTemplates(prev => [...prev, newTemplate]);
      setNotification({
        open: true,
        message: 'テンプレートを作成しました',
        severity: 'success',
      });
    }

    setIsFormOpen(false);
    setEditingTemplate(null);
    setActiveTab(0); // 一覧タブに切り替え
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setActiveTab(0); // 一覧タブに切り替え
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* ページヘッダー */}
      <Paper elevation={1} sx={{ mb: 3 }}>
        <Box sx={{ px: 3, py: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                支援手順テンプレート管理
              </Typography>
              <Typography variant="body1" color="text.secondary">
                個別支援手順のテンプレートを管理します。利用者様の支援計画作成時に使用できます。
              </Typography>
            </Box>

            {!isFormOpen && (
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={handleAddTemplate}
                sx={{ minWidth: 180 }}
              >
                新規テンプレート作成
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* メインコンテンツ */}
      <Paper elevation={1}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="支援手順テンプレート管理タブ"
          >
            <Tab
              icon={<TemplatesIcon />}
              label="テンプレート一覧"
              iconPosition="start"
              {...a11yProps(0)}
            />
            {isFormOpen && (
              <Tab
                icon={<AddIcon />}
                label={editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
                iconPosition="start"
                {...a11yProps(1)}
              />
            )}
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {allTemplates.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary" mb={2}>
                テンプレートがありません
              </Typography>
              <Typography variant="body1" color="text.disabled" mb={3}>
                新しい支援手順テンプレートを作成してください
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddTemplate}
              >
                テンプレート作成
              </Button>
            </Box>
          ) : (
            <SupportStepTemplateList
              templates={allTemplates}
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

      {/* 通知メッセージ */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SupportStepMasterPage;