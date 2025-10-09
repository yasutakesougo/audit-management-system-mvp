/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Options<T extends Record<string, any>> = {
  storageKey: string;
  defaults: T;
  migrateFromKeys?: string[];
  debounceKeys?: (keyof T)[];
  debounceMs?: number;
  ignoreEqualUpdates?: boolean;
};

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = value[key];
      return acc;
    }, {});
}

function stableSerialize(value: unknown): string {
  const result = JSON.stringify(value, (_key, val) => {
    if (!val || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => (item && typeof item === 'object' ? sortObjectKeys(item as Record<string, unknown>) : item));
    }
    return sortObjectKeys(val as Record<string, unknown>);
  });
  return typeof result === 'string' ? result : 'undefined';
}

function serializeSafe(value: unknown): string {
  try {
    return stableSerialize(value);
  } catch {
    return '';
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return serializeSafe(a) === serializeSafe(b);
}

const deriveMigrationFlagKey = (storageKey: string): string => {
  const parts = storageKey.split('.');
  if (parts.length <= 1) {
    return `${storageKey}.migrated`;
  }
  parts[parts.length - 1] = 'migrated';
  return parts.join('.');
};

export function usePersistedFilters<T extends Record<string, any>>({
  storageKey,
  defaults,
  migrateFromKeys = [],
  debounceKeys = [],
  debounceMs = 300,
  ignoreEqualUpdates = true,
}: Options<T>) {
  const defaultsRef = useRef<T>(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  const migrateKeysRef = useRef<string[]>(migrateFromKeys);
  useEffect(() => {
    migrateKeysRef.current = migrateFromKeys;
  }, [migrateFromKeys]);

  const initializer = useMemo<() => T>(() => {
    const migrationFlagKey = deriveMigrationFlagKey(storageKey);
    return () => {
      const base = { ...defaultsRef.current } as T;
      if (typeof window === 'undefined') {
        return base;
      }
      try {
        const currentRaw = window.sessionStorage.getItem(storageKey);
        if (currentRaw) {
          const parsed = JSON.parse(currentRaw) as Partial<T>;
          return { ...base, ...parsed } as T;
        }
        const alreadyMigrated = window.sessionStorage.getItem(migrationFlagKey) === '1';
        if (!alreadyMigrated) {
          for (const legacy of migrateKeysRef.current) {
            const legacyRaw = window.sessionStorage.getItem(legacy);
            if (!legacyRaw) continue;
            const parsedLegacy = JSON.parse(legacyRaw) as Partial<T>;
            const migrated = { ...base, ...parsedLegacy } as T;
            window.sessionStorage.setItem(storageKey, serializeSafe(migrated));
            window.sessionStorage.setItem(migrationFlagKey, '1');
            window.sessionStorage.removeItem(legacy);
            return migrated;
          }
          window.sessionStorage.setItem(migrationFlagKey, '1');
        }
      } catch {
        // ignore broken storage entries
      }
      return base;
    };
  }, [storageKey]);

  const [filters, setFilters] = useState<T>(() => initializer());

  const lastSavedRef = useRef<string>(serializeSafe(filters));

  const save = useCallback(
    (next: T) => {
      if (typeof window === 'undefined') return;
      const serialized = serializeSafe(next);
      if (ignoreEqualUpdates && serialized === lastSavedRef.current) return;
      try {
        window.sessionStorage.setItem(storageKey, serialized);
        lastSavedRef.current = serialized;
      } catch {
        // ignore write errors (storage full / disabled)
      }
    },
    [ignoreEqualUpdates, storageKey],
  );

  useEffect(() => {
    save(filters);
  }, [filters, save]);

  const debounceKeySet = useMemo(() => new Set<keyof T>(debounceKeys ?? []), [debounceKeys]);
  const debouncedRef = useRef<T>(filters);
  const [debouncedState, setDebouncedState] = useState<T>(filters);

  const commitDebounced = useCallback((next: T) => {
    if (deepEqual(debouncedRef.current, next)) {
      return;
    }
    debouncedRef.current = next;
    setDebouncedState(next);
  }, []);

  const isDebouncing = useMemo(() => !deepEqual(filters, debouncedState), [filters, debouncedState]);

  useEffect(() => {
    if (debounceKeySet.size === 0) {
      if (!deepEqual(debouncedRef.current, filters)) {
        commitDebounced({ ...filters });
      }
      return;
    }

    const immediate: T = { ...debouncedRef.current };
    let changedImmediate = false;
    (Object.keys(filters) as (keyof T)[]).forEach((key) => {
      if (debounceKeySet.has(key)) return;
      const nextValue = filters[key];
      if (!deepEqual(immediate[key], nextValue)) {
        (immediate as any)[key] = nextValue;
        changedImmediate = true;
      }
    });
    if (changedImmediate && !deepEqual(immediate, debouncedRef.current)) {
      commitDebounced({ ...immediate });
    }

    const pendingKeys = Array.from(debounceKeySet).filter((key) => !deepEqual(filters[key], debouncedRef.current[key]));
    if (pendingKeys.length === 0) {
      return;
    }

    let timeoutId: number | null = null;
    if (typeof window !== 'undefined') {
      timeoutId = window.setTimeout(() => {
        const nextState: T = { ...debouncedRef.current };
        let changed = false;
        pendingKeys.forEach((key) => {
          const nextValue = filters[key];
          if (!deepEqual(nextState[key], nextValue)) {
            (nextState as any)[key] = nextValue;
            changed = true;
          }
        });
        if (changed && !deepEqual(nextState, debouncedRef.current)) {
          commitDebounced(nextState);
        }
      }, debounceMs);
    }

    return () => {
      if (timeoutId != null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [commitDebounced, debounceKeySet, debounceMs, filters]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => {
      if (deepEqual(prev[key], value)) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const reset = useCallback(() => {
    const nextDefaults = { ...defaultsRef.current } as T;
    setFilters(nextDefaults);
    commitDebounced(nextDefaults);
    lastSavedRef.current = serializeSafe(nextDefaults);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(storageKey, lastSavedRef.current);
      } catch {
        // ignore write errors
      }
    }
  }, [commitDebounced, setFilters, storageKey]);

  return {
    filters,
    debounced: debouncedState,
    setFilters,
    update,
    reset,
    isDebouncing,
  };
}
