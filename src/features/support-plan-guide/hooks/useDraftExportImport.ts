/**
 * useDraftExportImport — JSON/Markdown export and import handlers
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 */

import React from 'react';
import type { SupportPlanDraftRepository } from '../domain/SupportPlanDraftRepository';
import type { SectionKey, SupportPlanDraft, ToastState } from '../types';
import { parseDraftPayload } from './draftPersistence';

export interface DraftExportImportParams {
  activeDraftId: string;
  drafts: Record<string, SupportPlanDraft>;
  markdown: string;
  activeDraft: SupportPlanDraft | undefined;
  repository: SupportPlanDraftRepository;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
  setActiveDraftId: (id: string) => void;
  setActiveTab: (tab: SectionKey) => void;
  setToast: (toast: ToastState) => void;
  setSyncError: (error: string | null) => void;
}

export function useDraftExportImport({
  activeDraftId,
  drafts,
  markdown,
  activeDraft,
  repository,
  setDrafts,
  setActiveDraftId,
  setActiveTab,
  setToast,
  setSyncError,
}: DraftExportImportParams) {
  const triggerDownload = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async (overrideContent?: string) => {
    if (!activeDraft) return;
    try {
      const content = typeof overrideContent === 'string' ? overrideContent : markdown;
      await navigator.clipboard.writeText(content);
      setToast({
        open: true,
        message: `${activeDraft.name || '利用者'}のMarkdownをコピーしました`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy markdown', error);
      setToast({ open: true, message: 'コピーに失敗しました。ブラウザ設定をご確認ください。', severity: 'error' });
    }
  };

  const handleExportJson = () => {
    const payload = {
      version: 2,
      updatedAt: new Date().toISOString(),
      activeDraftId,
      drafts,
    };
    triggerDownload(JSON.stringify(payload, null, 2), 'support-plan-draft.json', 'application/json');
    setToast({ open: true, message: 'JSONをダウンロードしました', severity: 'info' });
  };

  const handleDownloadMarkdown = (overrideContent?: string, overrideFilename?: string) => {
    if (!activeDraft) return;
    const content = typeof overrideContent === 'string' ? overrideContent : markdown;
    const filename = overrideFilename || `${activeDraft.name || 'support-plan'}-draft.md`;
    triggerDownload(content, filename, 'text/markdown');
    setToast({ open: true, message: `${activeDraft.name || '利用者'}のMarkdownをダウンロードしました`, severity: 'info' });
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = parseDraftPayload(parsed);

      if (!result) {
        throw new Error('Invalid payload');
      }

      // Optimistic: update local state immediately
      setDrafts(result.drafts);
      setActiveDraftId(result.activeDraftId ?? Object.values(result.drafts)[0].id);
      setActiveTab('overview');
      setToast({ open: true, message: 'JSONを読み込みました', severity: 'success' });

      // Background SP bulk save
      repository.bulkSave(Object.values(result.drafts)).catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'SharePoint一括保存に失敗しました';
        setSyncError(msg);
        console.error('SP bulk save after import failed:', error);
      });
    } catch (error) {
      console.error('Failed to import JSON', error);
      setToast({ open: true, message: 'JSONの読み込みに失敗しました', severity: 'error' });
    } finally {
      event.target.value = '';
    }
  };

  return { handleCopyMarkdown, handleExportJson, handleDownloadMarkdown, handleImportJson };
}
