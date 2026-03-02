/**
 * useSupportPlanForm — フォーム状態管理カスタムフック
 *
 * SupportPlanGuidePage.tsx から状態管理・副作用・ハンドラを抽出。
 * UIレンダリングは一切含まない純粋なロジック層。
 *
 * Phase 3: SharePoint連携 (非同期 Repository) + localStorage ライトスルーキャッシュ
 */
import type { SelectChangeEvent } from '@mui/material/Select';
import React from 'react';

import type { IUserMaster } from '@/features/users/types';
import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { useSupportPlanDraftRepository } from '../repositoryFactory';
import type {
    DeadlineInfo,
    SectionKey,
    SupportPlanDraft,
    SupportPlanForm,
    ToastState,
    UserOption,
} from '../types';
import {
    FIELD_KEYS,
    FIELD_LIMITS,
    MAX_DRAFTS,
    NAME_LIMIT,
    REQUIRED_FIELDS,
    SAVE_DEBOUNCE,
    STORAGE_KEY,
} from '../types';
import {
    computeDeadlineInfo,
    computeFilledCount,
    createDraft,
    createDraftForUser,
    createEmptyForm,
    sanitizeForm,
    sanitizeValue,
} from '../utils/helpers';
import { buildMarkdown } from '../utils/markdownExport';

// ────────────────────────────────────────────
// Params & Return type
// ────────────────────────────────────────────

export type UseSupportPlanFormParams = {
  isAdmin: boolean;
  locationSearch: string;
  userList: IUserMaster[];
};

export type UseSupportPlanFormReturn = {
  // ── Sync State ──
  isFetching: boolean;
  isSaving: boolean;
  syncError: string | null;
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId: string;
  activeTab: SectionKey;
  previewMode: 'render' | 'source';
  toast: ToastState;
  liveMessage: string;

  // ── Derived ──
  draftList: SupportPlanDraft[];
  activeDraft: SupportPlanDraft | undefined;
  form: SupportPlanForm;
  markdown: string;
  deadlines: { creation: DeadlineInfo; monitoring: DeadlineInfo };
  auditAlertCount: number;
  filledCount: number;
  completionPercent: number;
  maxDraftsReached: boolean;
  userOptions: UserOption[];

  // ── Actions ──
  setActiveTab: (tab: SectionKey) => void;
  setActiveDraftId: (id: string) => void;
  setPreviewMode: (mode: 'render' | 'source') => void;
  setToast: (toast: ToastState) => void;
  handleFieldChange: (key: keyof SupportPlanForm, value: string) => void;
  handleAppendPhrase: (key: keyof SupportPlanForm, phrase: string) => void;
  handleReset: () => void;
  handleCopyMarkdown: () => Promise<void>;
  handleDownloadMarkdown: () => void;
  handleExportJson: () => void;
  handleImportJson: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddDraft: () => void;
  handleMasterUserChange: (event: SelectChangeEvent<string>) => void;
  handleDeleteDraft: () => void;
  handleRenameDraft: (name: string) => void;
};

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/** Persist drafts + activeDraftId to localStorage (sync, write-through). */
function persistToLocalStorage(
  drafts: Record<string, SupportPlanDraft>,
  activeDraftId: string,
): void {
  try {
    const payload = {
      version: 2,
      updatedAt: new Date().toISOString(),
      activeDraftId,
      drafts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('support-plan-updated'));
  } catch {
    // localStorage full / disabled — silent fail (SP is the source of truth)
  }
}

/** Load drafts from localStorage (fallback for offline / SP errors). */
function loadFromLocalStorage(): {
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId?: string;
  lastSavedAt?: number;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    let loadedDrafts: Record<string, SupportPlanDraft> | null = null;
    let loadedActiveId: string | undefined;

    if (parsed?.drafts) {
      const draftEntries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
        ? parsed.drafts
        : Object.values(parsed.drafts);
      loadedDrafts = {};
      draftEntries.slice(0, MAX_DRAFTS).forEach((entry) => {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return;
        const name =
          typeof entry.name === 'string' && entry.name.length > 0
            ? sanitizeValue(entry.name, NAME_LIMIT)
            : '利用者';
        const createdAt =
          typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
            ? entry.createdAt
            : new Date().toISOString();
        const updatedAt =
          typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
            ? entry.updatedAt
            : createdAt;
        loadedDrafts![entry.id] = {
          id: entry.id,
          name,
          createdAt,
          updatedAt,
          userId: entry.userId ?? null,
          userCode: entry.userCode ?? null,
          data: sanitizeForm(entry.data),
        };
      });
      loadedActiveId =
        typeof parsed.activeDraftId === 'string' && loadedDrafts[parsed.activeDraftId]
          ? parsed.activeDraftId
          : undefined;
    } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
      // Legacy v1 format migration
      const legacyData: Partial<SupportPlanForm> = parsed?.data ?? parsed;
      const legacyDraft = createDraft(
        typeof legacyData.serviceUserName === 'string' && legacyData.serviceUserName.trim()
          ? sanitizeValue(legacyData.serviceUserName.trim(), NAME_LIMIT)
          : '利用者 1',
      );
      legacyDraft.data = sanitizeForm(legacyData);
      loadedDrafts = { [legacyDraft.id]: legacyDraft };
      loadedActiveId = legacyDraft.id;
    }

    if (!loadedDrafts || Object.keys(loadedDrafts).length === 0) {

      return null;
    }

    return {
      drafts: loadedDrafts,
      activeDraftId: loadedActiveId,
      lastSavedAt: parsed?.updatedAt ? new Date(parsed.updatedAt).getTime() : undefined,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────
// Hook implementation
// ────────────────────────────────────────────

export function useSupportPlanForm({
  isAdmin,
  locationSearch,
  userList,
}: UseSupportPlanFormParams): UseSupportPlanFormReturn {
  // ── Repository ──
  const repository = useSupportPlanDraftRepository();

  // ── Primary state ──
  const [drafts, setDrafts] = React.useState<Record<string, SupportPlanDraft>>({});
  const [activeDraftId, setActiveDraftId] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<SectionKey>('overview');
  const [previewMode, setPreviewMode] = React.useState<'render' | 'source'>('render');
  const [toast, setToast] = React.useState<ToastState>({ open: false, message: '', severity: 'success' });
  const [_lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [liveMessage, setLiveMessage] = React.useState('');
  const [_selectedMasterUserId, setSelectedMasterUserId] = React.useState('');

  // ── Sync State (Phase 3) ──
  const [isFetching, setIsFetching] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  // ── Refs ──
  const initialised = React.useRef(false);
  const saveTimer = React.useRef<number>();
  const spSaveTimer = React.useRef<number>();

  // ── Normalise user list ──
  type LegacyUserRecord = IUserMaster & { UserId?: string; DisplayName?: string };
  const masterUsers: IUserMaster[] = React.useMemo(
    () =>
      (userList as LegacyUserRecord[]).map((user) => ({
        ...user,
        UserID: user.UserID ?? user.UserId ?? '',
        FullName: user.FullName ?? user.DisplayName ?? '',
      })),
    [userList],
  );

  // ── Derived: userOptions ──
  const userOptions = React.useMemo<UserOption[]>(() => {
    return (masterUsers ?? [])
      .filter((user) => user && user.IsActive !== false)
      .map((user) => {
        const baseName = user.FullName?.trim() || user.UserID?.trim() || `ID:${user.Id}`;
        const sanitizedLabel = sanitizeValue(baseName, NAME_LIMIT);
        const code = user.UserID?.trim();
        const label = code ? `${sanitizedLabel}（${code}）` : sanitizedLabel;
        return {
          id: String(user.Id),
          label,
          user,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  }, [masterUsers]);

  // ── Derived: drafts convenience ──
  const draftList = React.useMemo(
    () => Object.values(drafts).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [drafts],
  );
  const activeDraft = activeDraftId ? drafts[activeDraftId] : undefined;
  const form = activeDraft?.data ?? createEmptyForm();
  const markdown = React.useMemo(() => buildMarkdown(form), [form]);
  const deadlines = React.useMemo(() => computeDeadlineInfo(form), [form]);

  const auditAlertCount = React.useMemo(() => {
    let count = 0;
    if (deadlines.creation.daysLeft !== undefined && deadlines.creation.daysLeft < 0) count += 1;
    if (deadlines.monitoring.daysLeft !== undefined && deadlines.monitoring.daysLeft < 0) count += 1;
    return count;
  }, [deadlines]);

  const filledCount = computeFilledCount(form);
  const requiredCompleted = REQUIRED_FIELDS.reduce(
    (count, key) => (form[key].trim() ? count + 1 : count),
    0,
  );
  const completionPercent = Math.round((requiredCompleted / REQUIRED_FIELDS.length) * 100);
  const maxDraftsReached = draftList.length >= MAX_DRAFTS;

  // ════════════════════════════════════════════
  // EFFECTS
  // ════════════════════════════════════════════

  // ── 1) Bootstrap: load from SharePoint → fallback to localStorage ──
  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const draftLoadSpan = startFeatureSpan(HYDRATION_FEATURES.supportPlanGuide.draftLoad, {
        status: 'pending',
        phase: 'bootstrap',
      });
      let spanMeta: Record<string, unknown> = { status: 'pending' };

      setIsFetching(true);
      setSyncError(null);

      try {
        // ── Try SharePoint first ──
        const spDrafts = await repository.listDrafts();

        if (cancelled) return;

        if (spDrafts.length > 0) {
          // SP is the source of truth
          const draftsMap: Record<string, SupportPlanDraft> = {};
          spDrafts.slice(0, MAX_DRAFTS).forEach((draft) => {
            draftsMap[draft.id] = {
              ...draft,
              data: sanitizeForm(draft.data),
            };
          });
          const firstId = spDrafts[0].id;

          setDrafts(draftsMap);
          setActiveDraftId(firstId);

          // Write-through: overwrite localStorage with SP data
          persistToLocalStorage(draftsMap, firstId);

          spanMeta = {
            status: 'restored',
            drafts: Object.keys(draftsMap).length,
            source: 'sharepoint',
            bytes: estimatePayloadSize(draftsMap),
          };
        } else {
          // SP is empty — try localStorage fallback
          const local = loadFromLocalStorage();

          if (local) {
            setDrafts(local.drafts);
            setActiveDraftId(local.activeDraftId ?? Object.values(local.drafts)[0]?.id ?? '');
            if (local.lastSavedAt) setLastSavedAt(local.lastSavedAt);

            // Migrate local data to SP (background)
            repository.bulkSave(Object.values(local.drafts)).catch(() => {
              // Non-critical — will sync on next save
            });

            spanMeta = {
              status: 'restored',
              drafts: Object.keys(local.drafts).length,
              source: 'localStorage-migration',
              bytes: estimatePayloadSize(local.drafts),
            };
          } else {
            // No data anywhere — seed initial draft
            const initialDraft = createDraft('利用者 1');
            const seededDrafts = { [initialDraft.id]: initialDraft };
            setDrafts(seededDrafts);
            setActiveDraftId(initialDraft.id);
            persistToLocalStorage(seededDrafts, initialDraft.id);

            // Save seed to SP (background)
            repository.saveDraft(initialDraft).catch(() => {});

            spanMeta = {
              status: 'seeded',
              drafts: 1,
              source: 'bootstrap',
              bytes: estimatePayloadSize(seededDrafts),
            };
          }
        }

        draftLoadSpan?.({ meta: spanMeta });
      } catch (error) {
        if (cancelled) return;

        // ── SP failed — fallback to localStorage ──
        const errorMessage =
          error instanceof Error ? error.message : '通信エラーが発生しました';
        setSyncError(errorMessage);
        console.error('SharePoint bootstrap failed, falling back to localStorage', error);

        const local = loadFromLocalStorage();
        if (local) {
          setDrafts(local.drafts);
          setActiveDraftId(local.activeDraftId ?? Object.values(local.drafts)[0]?.id ?? '');
          if (local.lastSavedAt) setLastSavedAt(local.lastSavedAt);
          spanMeta = {
            status: 'fallback-localStorage',
            drafts: Object.keys(local.drafts).length,
            source: 'localStorage',
            bytes: estimatePayloadSize(local.drafts),
          };
        } else {
          const fallback = createDraft('利用者 1');
          const fallbackDrafts = { [fallback.id]: fallback };
          setDrafts(fallbackDrafts);
          setActiveDraftId(fallback.id);
          spanMeta = {
            status: 'fallback-seeded',
            drafts: 1,
            source: 'bootstrap',
            bytes: estimatePayloadSize(fallbackDrafts),
          };
        }

        draftLoadSpan?.({
          meta: { ...spanMeta, status: 'error' },
          error: errorMessage,
        });
      } finally {
        if (!cancelled) {
          initialised.current = true;
          setIsFetching(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
    // repository identity is stable (memoized in factory)
  }, []);

  // ── 2) Fallback sync: ensure at least 1 draft + activeDraftId is valid ──
  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }
    const ids = Object.keys(drafts);
    if (ids.length === 0) {
      const fallback = createDraft('利用者 1');
      setDrafts({ [fallback.id]: fallback });
      setActiveDraftId(fallback.id);
      return;
    }
    if (!activeDraftId || !drafts[activeDraftId]) {
      setActiveDraftId(ids[0]);
    }
  }, [drafts, activeDraftId]);

  // ── 3) URL param user sync ──
  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }
    const params = new URLSearchParams(locationSearch);
    const targetId = params.get('userId');
    if (!targetId) {
      return;
    }
    const option = userOptions.find((candidate) => candidate.id === targetId);
    if (!option) {
      return;
    }
    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === targetId,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      return;
    }
    if (draftList.length >= MAX_DRAFTS) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const newDraft = createDraftForUser(option.user);
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
  }, [draftList, locationSearch, userOptions]);

  // ── 4) Write-through auto-save: immediate localStorage + debounced SP ──
  React.useEffect(() => {
    if (!initialised.current) {
      return;
    }

    // ── Immediate localStorage write ──
    if (isAdmin) {
      persistToLocalStorage(drafts, activeDraftId);
      const now = Date.now();
      setLastSavedAt(now);
    }

    // ── Clear previous LS debounce timer ──
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    // ── LS live-message (with debounce to avoid spam) ──
    saveTimer.current = window.setTimeout(() => {
      if (!isAdmin) return;
      const now = Date.now();
      setLiveMessage(`自動保存しました（${new Date(now).toLocaleTimeString('ja-JP')}）`);
    }, SAVE_DEBOUNCE);

    // ── Debounced SharePoint save ──
    if (spSaveTimer.current) {
      window.clearTimeout(spSaveTimer.current);
    }
    spSaveTimer.current = window.setTimeout(() => {
      if (!isAdmin) return;

      const currentDraft = drafts[activeDraftId];
      if (!currentDraft) return;

      setIsSaving(true);
      setSyncError(null);

      repository
        .saveDraft(currentDraft)
        .then(() => {
          setSyncError(null);
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
          setSyncError(msg);
          console.error('SP save failed:', error);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, SAVE_DEBOUNCE);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      if (spSaveTimer.current) {
        window.clearTimeout(spSaveTimer.current);
      }
    };
  }, [drafts, activeDraftId, isAdmin]);

  // ── 5) Live-message auto-clear ──
  React.useEffect(() => {
    if (!liveMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setLiveMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [liveMessage]);

  // ════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════

  const handleFieldChange = (key: keyof SupportPlanForm, value: string) => {
    if (!activeDraftId || !isAdmin) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const updatedData = {
        ...target.data,
        [key]: sanitizeValue(value, FIELD_LIMITS[key]),
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleAppendPhrase = (key: keyof SupportPlanForm, phrase: string) => {
    if (!activeDraftId || !isAdmin) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const currentValue = target.data[key];
      const separator = currentValue ? (currentValue.trimEnd().endsWith('\n') ? '' : '\n') : '';
      const nextValue = `${currentValue ? currentValue.trimEnd() : ''}${separator}${phrase}`.trimStart();
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            [key]: sanitizeValue(nextValue, FIELD_LIMITS[key]),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleReset = () => {
    if (!activeDraftId) {
      return;
    }
    if (!window.confirm(`${activeDraft?.name ?? 'この利用者'}の入力内容をすべてリセットしますか？`)) {
      return;
    }
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const resetForm = createEmptyForm();
      resetForm.serviceUserName = sanitizeValue(target.name, FIELD_LIMITS.serviceUserName);
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: resetForm,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setActiveTab('overview');
    setToast({ open: true, message: `${activeDraft?.name ?? '利用者'}のフォームを初期化しました`, severity: 'success' });
    // SP save is handled by the auto-save effect (drafts changed → debounced sync)
  };

  const handleCopyMarkdown = async () => {
    if (!activeDraft) {
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
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

  const triggerDownload = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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

  const handleDownloadMarkdown = () => {
    if (!activeDraft) {
      return;
    }
    triggerDownload(markdown, `${activeDraft.name || 'support-plan'}-draft.md`, 'text/markdown');
    setToast({ open: true, message: `${activeDraft.name || '利用者'}のMarkdownをダウンロードしました`, severity: 'info' });
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let nextDrafts: Record<string, SupportPlanDraft> | null = null;
      let nextActiveId: string | undefined;

      if (parsed?.drafts) {
        const entries: SupportPlanDraft[] = Array.isArray(parsed.drafts)
          ? parsed.drafts
          : Object.values(parsed.drafts);
        nextDrafts = {};
        entries.slice(0, MAX_DRAFTS).forEach((entry) => {
          if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') {
            return;
          }
          const name =
            typeof entry.name === 'string' && entry.name.length > 0
              ? sanitizeValue(entry.name, NAME_LIMIT)
              : '利用者';
          const createdAt =
            typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
              ? entry.createdAt
              : new Date().toISOString();
          const updatedAt =
            typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt))
              ? entry.updatedAt
              : createdAt;
          nextDrafts![entry.id] = {
            id: entry.id,
            name,
            createdAt,
            updatedAt,
            userId: entry.userId ?? null,
            userCode: entry.userCode ?? null,
            data: sanitizeForm(entry.data),
          };
        });
        nextActiveId =
          typeof parsed.activeDraftId === 'string' && nextDrafts[parsed.activeDraftId]
            ? parsed.activeDraftId
            : undefined;
      } else if (parsed?.data || FIELD_KEYS.some((key) => typeof parsed?.[key] === 'string')) {
        const data: Partial<SupportPlanForm> = parsed?.data ?? parsed;
        const draft = createDraft(
          typeof data.serviceUserName === 'string' && data.serviceUserName.trim()
            ? sanitizeValue(data.serviceUserName.trim(), NAME_LIMIT)
            : '利用者 1',
        );
        draft.data = sanitizeForm(data);
        draft.userId = null;
        draft.userCode = null;
        nextDrafts = { [draft.id]: draft };
        nextActiveId = draft.id;
      }

      if (!nextDrafts || Object.keys(nextDrafts).length === 0) {
        throw new Error('Invalid payload');
      }

      // Optimistic: update local state immediately
      setDrafts(nextDrafts);
      setActiveDraftId(nextActiveId ?? Object.values(nextDrafts)[0].id);
      setActiveTab('overview');
      setToast({ open: true, message: 'JSONを読み込みました', severity: 'success' });

      // Background SP bulk save
      repository.bulkSave(Object.values(nextDrafts)).catch((error) => {
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

  const handleAddDraft = () => {
    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const nextIndex = draftList.length + 1;
    const newDraft = createDraft(`利用者 ${nextIndex}`);

    // Optimistic: update local state immediately
    setDrafts((prev) => ({ ...prev, [newDraft.id]: newDraft }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({ open: true, message: `${newDraft.name}を追加しました`, severity: 'success' });

    // Background SP save
    repository.saveDraft(newDraft).catch((error) => {
      const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
      setSyncError(msg);
      console.error('SP save for new draft failed:', error);
    });
  };

  const handleMasterUserChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (!value) {
      setSelectedMasterUserId('');
      return;
    }

    setSelectedMasterUserId(value);
    const option = userOptions.find((candidate) => candidate.id === value);
    const user = option?.user;
    if (!user) {
      setSelectedMasterUserId('');
      return;
    }

    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === value,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      setToast({
        open: true,
        message: `${user.FullName}のドラフトを開きました`,
        severity: 'info',
      });
      setSelectedMasterUserId('');
      return;
    }

    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      setSelectedMasterUserId('');
      return;
    }

    const newDraft = createDraftForUser(user);

    // Optimistic: update local state immediately
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({
      open: true,
      message: `${user.FullName}のドラフトを作成しました`,
      severity: 'success',
    });
    setSelectedMasterUserId('');

    // Background SP save
    repository.saveDraft(newDraft).catch((error) => {
      const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
      setSyncError(msg);
      console.error('SP save for user draft failed:', error);
    });
  };

  const handleDeleteDraft = () => {
    if (!activeDraftId || draftList.length <= 1) {
      setToast({ open: true, message: '少なくとも1名のドラフトが必要です', severity: 'info' });
      return;
    }
    const targetName = drafts[activeDraftId]?.name ?? '利用者';
    const targetId = activeDraftId;

    // Optimistic: remove from local state immediately
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setActiveDraftId('');
    setToast({ open: true, message: `${targetName}を削除しました`, severity: 'success' });

    // Background SP delete
    repository.deleteDraft(targetId).catch((error) => {
      const msg = error instanceof Error ? error.message : 'SharePoint削除に失敗しました';
      setSyncError(msg);
      console.error('SP delete draft failed:', error);
    });
  };

  const handleRenameDraft = (name: string) => {
    if (!activeDraftId) {
      return;
    }
    let nextName = sanitizeValue(name, NAME_LIMIT);
    if (!nextName.trim()) {
      nextName = '未設定の利用者';
    }

    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) {
        return prev;
      }
      const updatedData: SupportPlanForm = {
        ...target.data,
        serviceUserName: nextName,
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          name: nextName,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    // SP save is handled by the auto-save effect (drafts changed → debounced sync)
  };

  // ════════════════════════════════════════════
  // Return
  // ════════════════════════════════════════════

  return {
    // Sync State
    isFetching,
    isSaving,
    syncError,

    // State
    drafts,
    activeDraftId,
    activeTab,
    previewMode,
    toast,
    liveMessage,

    // Derived
    draftList,
    activeDraft,
    form,
    markdown,
    deadlines,
    auditAlertCount,
    filledCount,
    completionPercent,
    maxDraftsReached,
    userOptions,

    // Actions
    setActiveTab,
    setActiveDraftId,
    setPreviewMode,
    setToast,
    handleFieldChange,
    handleAppendPhrase,
    handleReset,
    handleCopyMarkdown,
    handleDownloadMarkdown,
    handleExportJson,
    handleImportJson,
    handleAddDraft,
    handleMasterUserChange,
    handleDeleteDraft,
    handleRenameDraft,
  };
}
