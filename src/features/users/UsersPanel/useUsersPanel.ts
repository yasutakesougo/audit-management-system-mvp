/**
 * useUsersPanel
 *
 * UsersPanel のパネルロジックを集約するカスタムフック。
 * タブ管理、詳細ユーザー管理、CRUD ハンドラ、フォーム表示管理を担う。
 */
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { AchievementRecordPDF } from '@/features/reports/achievement/AchievementRecordPDF';
import { useAchievementPDF } from '@/features/reports/achievement/useAchievementPDF';
import { exportMonthlySummary } from '@/features/reports/monthly/MonthlySummaryExcel';
import { pdf } from '@react-pdf/renderer';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ZodError } from 'zod';
import { AuthRequiredError } from '../../../lib/errors';
import { useUsersStore } from '../store';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import { useUsersDemoSeed } from '../useUsersDemoSeed';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type UsersTab = 'menu' | 'list' | 'create';

export type UseUsersPanelReturn = {
  // Data
  data: IUserMaster[];
  status: string;
  errorMessage: string | null;
  // Tab
  activeTab: UsersTab;
  setActiveTab: (tab: UsersTab) => void;
  // Detail
  detailUserKey: string | null;
  detailUser: IUserMaster | null;
  detailSectionRef: React.RefObject<HTMLDivElement>;
  // Busy
  busyId: number | null;
  isCreatePending: boolean;
  // Form dialogs
  showCreateForm: boolean;
  showEditForm: boolean;
  selectedUser: IUserMaster | null;
  setShowCreateForm: (v: boolean) => void;
  // Handlers
  handleCreate: (payload: IUserMasterCreateDto) => Promise<void>;
  handleDelete: (id: number | string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleDetailSelect: (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => void;
  handleDetailClose: () => void;
  handleEditClick: (user: IUserMaster) => void;
  handleCloseForm: () => void;
  handleCreateFormSuccess: (newUser: IUserMaster) => void;
  handleEditFormSuccess: (updatedUser: IUserMaster) => void;
  handleExportAchievementPDF: (userId: string) => Promise<void>;
  handleExportMonthlySummary: () => Promise<void>;
  integrityErrors: string[];
  // Refs
  panelOpenButtonRef: React.RefObject<HTMLButtonElement>;
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

export const buildErrorMessage = (error: unknown): string => {
  if (!error) return '原因不明のエラーが発生しました。';
  if (error instanceof AuthRequiredError) {
    return 'サインインが必要です。上部の「Sign in」を押して認証を完了してください。';
  }
  if (error instanceof Error) {
    if (error.message === 'AUTH_REQUIRED') {
      return 'サインインが必要です。上部の「Sign in」を押して認証を完了してください。';
    }
    return error.message;
  }
  return String(error);
};

// ---------------------------------------------------------------------------
// メインフック
// ---------------------------------------------------------------------------

export function useUsersPanel(): UseUsersPanelReturn {
  useUsersDemoSeed();
  const location = useLocation();
  const { data, status, create, remove, refresh, error } = useUsersStore();

  // ---- State ----
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
  const [detailUserKey, setDetailUserKey] = useState<string | null>(null);
  const [integrityErrors, setIntegrityErrors] = useState<string[]>([]);

  // ---- Tab management ----
  const isUsersTab = useCallback(
    (value: unknown): value is UsersTab =>
      value === 'menu' || value === 'list' || value === 'create',
    [],
  );

  const readTabFromLocation = useCallback((): UsersTab | null => {
    const stateTab = (location.state as { tab?: unknown } | null)?.tab;
    if (isUsersTab(stateTab)) return stateTab;
    const params = new URLSearchParams(location.search ?? '');
    const queryTab = params.get('tab');
    if (isUsersTab(queryTab)) return queryTab;
    return null;
  }, [isUsersTab, location.search, location.state]);

  const [activeTab, setActiveTab] = useState<UsersTab>(() => readTabFromLocation() ?? 'menu');
  const handledLocationRef = useRef<{ key: string; tab: UsersTab | null }>({
    key: location.key,
    tab: readTabFromLocation(),
  });

  useEffect(() => {
    const nextTab = readTabFromLocation();
    const handled = handledLocationRef.current;
    const keyChanged = location.key !== handled.key;
    const tabChanged = nextTab !== handled.tab;

    if (!nextTab) {
      if (keyChanged) {
        handledLocationRef.current = { key: location.key, tab: nextTab };
      }
      return;
    }

    if (!keyChanged && (!tabChanged || nextTab === activeTab)) {
      return;
    }

    handledLocationRef.current = { key: location.key, tab: nextTab };

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, location.key, readTabFromLocation]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIntegrityErrors([]);
        await refresh();
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
          setIntegrityErrors(messages);
        }
      }
    };
    fetchUsers();
  }, [refresh]);

  // ---- Detail user ----
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const panelOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const detailUser = useMemo(() => {
    if (!detailUserKey) return null;
    return data.find((user) => (user.UserID || String(user.Id)) === detailUserKey) ?? null;
  }, [data, detailUserKey]);

  useEffect(() => {
    if (!detailUserKey) return;
    if (!detailUser) {
      setDetailUserKey(null);
      return;
    }

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const element = detailSectionRef.current;
        if (element && typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [detailUser, detailUserKey]);

  // ---- CRUD handlers ----
  const handleCreate = useCallback(
    async (payload: IUserMasterCreateDto) => {
      setBusyId(-1);
      try {
        await create(payload);
        setActiveTab('list');
      } finally {
        setBusyId(null);
      }
    },
    [create],
  );

  const handleDelete = useCallback(
    async (id: number | string) => {
      if (!window.confirm('この利用者を削除しますか？')) return;
      setBusyId(Number(id));
      try {
        await remove(id);
      } finally {
        setBusyId(null);
      }
    },
    [remove],
  );

  const handleRefresh = useCallback(async () => {
    if (busyId !== null) return;
    setBusyId(-2);
    try {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [busyId, refresh]);

  // ---- Detail handlers ----
  const handleDetailSelect = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      const key = user.UserID || String(user.Id);
      setActiveTab('list');
      setDetailUserKey((prev) => (prev === key ? null : key));
    },
    [],
  );

  const handleDetailClose = useCallback(() => {
    setDetailUserKey(null);
  }, []);

  // ---- Form dialog handlers ----
  const handleCreateFormSuccess = useCallback(
    (newUser: IUserMaster) => {
      console.log('利用者が作成されました:', newUser);
      setShowCreateForm(false);
      void refresh();
      setActiveTab('list');
    },
    [refresh],
  );

  const handleEditFormSuccess = useCallback(
    (updatedUser: IUserMaster) => {
      console.log('利用者情報が更新されました:', updatedUser);
      setShowEditForm(false);
      setSelectedUser(null);
      void refresh();
      setActiveTab('list');
    },
    [refresh],
  );

  const handleEditClick = useCallback((user: IUserMaster) => {
    setSelectedUser(user);
    setShowEditForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedUser(null);
  }, []);

  // ---- Export handlers ----
  const { prepareData: preparePDFData } = useAchievementPDF();
  const dailyRepository = useDailyRecordRepository();

  const handleExportAchievementPDF = useCallback(async (userId: string) => {
    const targetMonth = format(new Date(), 'yyyy-MM'); // Default to current month
    const pdfData = await preparePDFData(userId, targetMonth);
    if (!pdfData) return;

    try {
      const blob = await pdf(
        React.createElement(AchievementRecordPDF, pdfData) as any
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `実績記録票_${pdfData.userName}_${targetMonth}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDFの生成に失敗しました。');
    }
  }, [preparePDFData]);

  const handleExportMonthlySummary = useCallback(async () => {
    const targetMonth = format(new Date(), 'yyyy-MM');
    setBusyId(-3); // Specific busy ID for export
    try {
      const start = startOfMonth(parseISO(`${targetMonth}-01`));
      const end = endOfMonth(start);
      const records = await dailyRepository.list({
        range: {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        },
      });

      exportMonthlySummary({
        month: targetMonth,
        users: data.map(u => ({
          id: u.Id,
          userId: u.UserID || String(u.Id),
          name: u.FullName,
          severe: u.severeFlag || false,
          active: u.IsActive || false,
          toDays: u.TransportToDays || [],
          fromDays: u.TransportFromDays || [],
          attendanceDays: u.AttendanceDays || [],
          furigana: u.Furigana || '',
          nameKana: u.FullNameKana || '',
          certNumber: u.RecipientCertNumber || '',
          certExpiry: u.RecipientCertExpiry || '',
          highIntensitySupport: u.IsHighIntensitySupportTarget || false,
        })),
        records,
      });
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Excel出力に失敗しました。');
    } finally {
      setBusyId(null);
    }
  }, [data, dailyRepository]);

  // ---- Derived ----
  const errorMessage = error ? buildErrorMessage(error) : null;
  const isCreatePending = busyId === -1;

  return {
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
    handleExportAchievementPDF,
    handleExportMonthlySummary,
    integrityErrors,
    panelOpenButtonRef,
  };
}
