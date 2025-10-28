import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { SupportActivityTemplate, defaultSupportActivities } from '../domain/support/types';
import { SupportActivityTemplateForm } from '../features/support/SupportActivityTemplateForm';
import { SupportActivityTemplateList } from '../features/support/SupportActivityTemplateList';

const STORAGE_KEY = 'supportActivityTemplates';

const buildDefaultTemplates = (): SupportActivityTemplate[] =>
  defaultSupportActivities.map((template, index) => ({
    ...template,
    iconEmoji: template.iconEmoji ?? '📋',
    id: `default-${index + 1}`
  }));

const loadTemplates = (): SupportActivityTemplate[] => {
  if (typeof window === 'undefined') {
    return buildDefaultTemplates();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return buildDefaultTemplates();
  }

  try {
    const parsed = JSON.parse(raw) as SupportActivityTemplate[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((template, index) => ({
        ...template,
        iconEmoji: template.iconEmoji ?? '📋',
        id: template.id || `restored-${index}`
      }));
    }
  } catch {
    // no-op fallback to defaults
  }

  return buildDefaultTemplates();
};

const SupportActivityMasterPage: React.FC = () => {
  const [templates, setTemplates] = useState<SupportActivityTemplate[]>(loadTemplates);
  const [editingTemplate, setEditingTemplate] = useState<SupportActivityTemplate | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
  }, [templates]);

  // 新規テンプレート作成
  const handleAdd = useCallback(() => {
    setEditingTemplate(undefined);
    setIsFormOpen(true);
  }, []);

  // テンプレート編集
  const handleEdit = useCallback((template: SupportActivityTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  }, []);

  // テンプレート削除
  const handleDelete = useCallback((templateId: string) => {
    // 削除確認ダイアログを表示するのが理想的
    if (window.confirm('このテンプレートを削除しますか？\n※削除後は元に戻せません。')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setSnackbar({
        open: true,
        message: 'テンプレートを削除しました。',
        severity: 'success'
      });
    }
  }, []);

  // テンプレート保存
  const handleSave = useCallback((templateData: Omit<SupportActivityTemplate, 'id'>) => {
    if (editingTemplate) {
      // 編集の場合
      setTemplates(prev => prev.map(t =>
        t.id === editingTemplate.id
          ? { ...templateData, iconEmoji: templateData.iconEmoji ?? '📋', id: editingTemplate.id }
          : t
      ));
      setSnackbar({
        open: true,
        message: 'テンプレートを更新しました。',
        severity: 'success'
      });
    } else {
      // 新規作成の場合
      const newTemplate: SupportActivityTemplate = {
        ...templateData,
        iconEmoji: templateData.iconEmoji ?? '📋',
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      setTemplates(prev => [...prev, newTemplate]);
      setSnackbar({
        open: true,
        message: 'テンプレートを作成しました。',
        severity: 'success'
      });
    }

    setIsFormOpen(false);
    setEditingTemplate(undefined);
  }, [editingTemplate]);

  // フォームキャンセル
  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  }, []);

  // スナックバークローズ
  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* パンくずナビ */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          href="/"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          color="inherit"
        >
          <HomeIcon sx={{ mr: 0.5, fontSize: 20 }} />
          ホーム
        </Link>
        <Link
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          color="inherit"
        >
          <SettingsIcon sx={{ mr: 0.5, fontSize: 20 }} />
          設定管理
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          支援活動テンプレート管理
        </Typography>
      </Breadcrumbs>

      {/* ページタイトル */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          支援活動テンプレート管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          支援手順記録で使用する活動テンプレートの登録・編集・削除を行います。
          <br />
          テンプレートを作成することで、支援記録の入力が効率化されます。
        </Typography>
      </Box>

      {/* メインコンテンツ */}
      <Box sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        minHeight: 'calc(100vh - 200px)'
      }}>
        <SupportActivityTemplateList
          templates={templates}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
      </Box>

      {/* 編集フォームダイアログ */}
      <SupportActivityTemplateForm
        open={isFormOpen}
        template={editingTemplate}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {/* 成功・エラー通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SupportActivityMasterPage;