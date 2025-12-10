import { NURSE_USERS } from '@/features/nurse/users';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type WorkspaceTab = 'seizure' | 'bp';

export interface WorkspaceParams {
  user: string;
  date: string;
  tab: WorkspaceTab;
  set: (next: PartialParams) => void;
}

export type PartialParams = Partial<Pick<WorkspaceParams, 'user' | 'date' | 'tab'>>;

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const isValidISODate = (value: string): boolean => {
  if (!isoPattern.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === value;
};

export function useObsWorkspaceParams(): WorkspaceParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsSignature = searchParams.toString();

  const rawUser = (searchParams.get('user') ?? '').trim();
  const rawDate = searchParams.get('date') ?? '';
  const rawTab = (searchParams.get('tab') ?? '').trim().toLowerCase();
  const isISODate = isValidISODate(rawDate);
  const { fallbackUser, validUserIds } = useMemo(() => {
    const ids = new Set<string>();
    let firstActive = '';
    for (const entry of NURSE_USERS) {
      ids.add(entry.id);
      if (!firstActive && entry.isActive) {
        firstActive = entry.id;
      }
    }
    return {
      fallbackUser: firstActive || NURSE_USERS[0]?.id || '',
      validUserIds: ids,
    };
  }, []);
  const safeUser = rawUser && validUserIds.has(rawUser) ? rawUser : fallbackUser;
  const safeDate = isISODate ? rawDate : todayISO();
  const safeTab: WorkspaceTab = rawTab === 'bp' ? 'bp' : 'seizure';

  useEffect(() => {
    const currentSignature = paramsSignature;
    const next = new URLSearchParams(currentSignature);
    if ((!rawUser || !validUserIds.has(rawUser)) && fallbackUser) {
      next.set('user', fallbackUser);
    }
    if (!isISODate) {
      next.set('date', safeDate);
    }
    if (rawTab !== safeTab) {
      next.set('tab', safeTab);
    }
    if (next.toString() !== currentSignature) {
      setSearchParams(next, { replace: true });
    }
  }, [fallbackUser, isISODate, paramsSignature, rawUser, safeDate, setSearchParams, safeTab, rawTab, validUserIds]);

  const setter = useCallback(
    (next: PartialParams) => {
      const merged = new URLSearchParams(paramsSignature);
      if (next.user !== undefined) {
        const trimmed = next.user.trim();
        if (trimmed) {
          if (validUserIds.has(trimmed)) {
            merged.set('user', trimmed);
          } else if (fallbackUser) {
            merged.set('user', fallbackUser);
          } else {
            merged.delete('user');
          }
        } else {
          merged.delete('user');
        }
      }
      if (next.date !== undefined) {
        const candidate = next.date;
        if (candidate && isValidISODate(candidate)) {
          merged.set('date', candidate);
        } else if (candidate) {
          const parsed = new Date(candidate);
          if (!Number.isNaN(parsed.getTime())) {
            merged.set('date', parsed.toISOString().slice(0, 10));
          } else {
            merged.delete('date');
          }
        } else {
          merged.delete('date');
        }
      }
      if (next.tab !== undefined) {
        const candidate = next.tab;
        if (candidate === 'bp' || candidate === 'seizure') {
          merged.set('tab', candidate);
        } else {
          merged.set('tab', 'seizure');
        }
      }
      setSearchParams(merged, { replace: true });
    },
    [paramsSignature, setSearchParams]
  );

  const result = useMemo<WorkspaceParams>(
    () => ({ user: safeUser, date: safeDate, tab: safeTab, set: setter }),
    [safeUser, safeDate, safeTab, setter]
  );

  return result;
}
