/**
 * useUsersPanelTabs
 *
 * タブ管理 + 詳細ユーザー選択 + URL同期
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export function useUsersPanelTabs(
  data: IUserMaster[],
  status: string,
): UseUsersPanelTabsReturn {
  const location = useLocation();
  const navigate = useNavigate();

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

  const readSelectedFromLocation = useCallback((): string | null => {
    const params = new URLSearchParams(location.search ?? '');
    const raw = (params.get('selected') ?? '').trim();
    return raw || null;
  }, [location.search]);

  const syncSelectedInUrl = useCallback(
    (selectedKey: string | null) => {
      const currentSelected = readSelectedFromLocation();
      const nextSelected = selectedKey?.trim() || null;

      const params = new URLSearchParams(location.search ?? '');
      if (nextSelected) {
        params.set('selected', nextSelected);
        // selected 指定時は一覧タブを明示
        if (!isUsersTab(params.get('tab'))) {
          params.set('tab', 'list');
        }
      } else {
        params.delete('selected');
      }

      const nextSearch = params.toString();
      const next = nextSearch ? `?${nextSearch}` : '';

      if (currentSelected === nextSelected && next === (location.search || '')) {
        return;
      }

      navigate(
        {
          pathname: location.pathname,
          search: next,
        },
        { replace: true },
      );
    },
    [isUsersTab, location.pathname, location.search, navigate, readSelectedFromLocation],
  );

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
  const [detailUserKey, setDetailUserKey] = useState<string | null>(readSelectedFromLocation);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const panelOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const handledSelectedRef = useRef<{ key: string; selected: string | null }>({
    key: location.key,
    selected: readSelectedFromLocation(),
  });

  const detailUser = useMemo(() => {
    if (!detailUserKey) return null;
    return data.find((user) => resolveUserIdentifier(user) === detailUserKey) ?? null;
  }, [data, detailUserKey]);

  useEffect(() => {
    const selectedFromLocation = readSelectedFromLocation();
    const handled = handledSelectedRef.current;
    const keyChanged = location.key !== handled.key;
    const selectedChanged = selectedFromLocation !== handled.selected;

    if (!keyChanged && !selectedChanged) {
      return;
    }

    handledSelectedRef.current = {
      key: location.key,
      selected: selectedFromLocation,
    };

    if (selectedFromLocation !== detailUserKey) {
      setDetailUserKey(selectedFromLocation);
    }
    if (selectedFromLocation && activeTab !== 'list') {
      setActiveTab('list');
    }
  }, [activeTab, detailUserKey, location.key, readSelectedFromLocation]);

  useEffect(() => {
    if (!detailUserKey) return;
    if (status === 'loading') return;

    if (!detailUser) {
      setDetailUserKey(null);
      syncSelectedInUrl(null);
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
  }, [detailUser, detailUserKey, status, syncSelectedInUrl]);

  // ---- Detail handlers ----
  const handleDetailSelect = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      const key = user.UserID || String(user.Id);
      const next = detailUserKey === key ? null : key;
      setActiveTab('list');
      setDetailUserKey(next);
      syncSelectedInUrl(next);
    },
    [detailUserKey, syncSelectedInUrl],
  );

  const handleDetailClose = useCallback(() => {
    setDetailUserKey(null);
    syncSelectedInUrl(null);
  }, [syncSelectedInUrl]);

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
