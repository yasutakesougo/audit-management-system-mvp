import RestoreIcon from '@mui/icons-material/Restore';
import SettingsIcon from '@mui/icons-material/Settings';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import React, { useCallback, useEffect, useState } from 'react';

import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { SupportActivityTemplate, defaultSupportActivities } from '@/domain/support/types';
import { SupportActivityTemplateForm } from '../features/ibd/procedures/templates/SupportActivityTemplateForm';
import { SupportActivityTemplateList } from '../features/ibd/procedures/templates/SupportActivityTemplateList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

// LocalStorage管理: 今はローカルストレージ版の簡易マスタです。
// 将来的にSharePointの支援活動マスタへ移行予定
const STORAGE_KEY = 'ams.supportActivityTemplates.v1';
const META_KEY = 'ams.supportActivityTemplates.meta.v1';

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
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      // IBDハブ用メタ情報（件数・最終更新日）
      window.localStorage.setItem(
        META_KEY,
        JSON.stringify({ count: templates.length, updatedAt: new Date().toISOString() }),
      );
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
    confirm.open({
      title: 'テンプレート削除',
      message: 'このテンプレートを削除しますか？',
      warningText: '削除後は元に戻せません。',
      severity: 'error',
      confirmLabel: '削除',
      onConfirm: () => {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        setSnackbar({
          open: true,
          message: 'テンプレートを削除しました。',
          severity: 'success'
        });
      },
    });
  }, [confirm]);

  // デフォルトテンプレートにリセット
  const handleResetToDefaults = useCallback(() => {
    confirm.open({
      title: 'デフォルトに復元',
      message: 'すべてのテンプレートをデフォルト設定に戻しますか？',
      warningText: '現在の設定は失われます。',
      severity: 'warning',
      confirmLabel: 'リセット',
      onConfirm: () => {
        const defaultTemplates = buildDefaultTemplates();
        setTemplates(defaultTemplates);
        setSnackbar({
          open: true,
          message: 'デフォルトテンプレートに復元しました。',
          severity: 'success'
        });
      },
    });
  }, [confirm]);

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
    <Box data-testid="support-activity-master-page">
      {/* ── IBDPageHeader ── */}
      <IBDPageHeader
        title="支援活動マスタ"
        subtitle="支援手順の実施で使用する活動マスタの登録・編集・削除を行います。"
        icon={<SettingsIcon />}
        actions={
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RestoreIcon />}
            onClick={handleResetToDefaults}
            size="small"
          >
            デフォルトに戻す
          </Button>
        }
      />

      {/* メインコンテンツ */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <SupportActivityTemplateList
          templates={templates}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
      </Paper>

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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 確認ダイアログ */}
      <ConfirmDialog {...confirm.dialogProps} />
    </Box>
  );
};

export default SupportActivityMasterPage;
