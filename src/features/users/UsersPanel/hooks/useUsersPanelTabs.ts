/**
 * useUsersPanelTabs
 *
 * タブ管理 + 詳細ユーザー選択 + URL同期
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveUserIdentifier } from '../../UserDetailSections/helpers';
import type { IUserMaster } from '../../types';

export type UsersTab = 'menu' | 'list' | 'create';

export type UseUsersPanelTabsReturn = {
  activeTab: UsersTab;
  setActiveTab: (tab: UsersTab) => void;
  detailUserKey: string | null;
  detailUser: IUserMaster | null;
  detailSectionRef: React.RefObject<HTMLDivElement>;
  panelOpenButtonRef: React.RefObject<HTMLButtonElement>;
  handleDetailSelect: (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => void;
  handleDetailClose: () => void;
};

export function useUsersPanelTabs(data: IUserMaster[]): UseUsersPanelTabsReturn {
  const location = useLocation();

  // ---- Tab state ----
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

  // ---- Detail user ----
  const [detailUserKey, setDetailUserKey] = useState<string | null>(null);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const panelOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const detailUser = useMemo(() => {
    if (!detailUserKey) return null;
    return data.find((user) => resolveUserIdentifier(user) === detailUserKey) ?? null;
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

  return {
    activeTab,
    setActiveTab,
    detailUserKey,
    detailUser,
    detailSectionRef,
    panelOpenButtonRef,
    handleDetailSelect,
    handleDetailClose,
  };
}
