/**
 * useAdminOverride
 *
 * 管理者の承認（PIN入力）により、非 admin ユーザーに一時的な編集権限を付与する。
 * sessionStorage に TTL 付きで保持し、有効期限切れで自動失効。
 *
 * 用途: 単一端末 pilot で、管理者がそばにいる状態でスタッフに一時的に編集を許可するケース。
 */
import { readOptionalEnv } from '@/lib/env';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'admin-override.v1';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 分
const DEFAULT_PIN = '0000';

type OverridePayload = {
  expiresAt: number;
};

function readOverride(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<OverridePayload>;
    if (!parsed || typeof parsed.expiresAt !== 'number') return false;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function writeOverride(ttlMs: number): void {
  const payload: OverridePayload = { expiresAt: Date.now() + ttlMs };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearOverride(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export type AdminOverrideResult = {
  /** 一時的な編集権限が有効かどうか */
  isOverrideActive: boolean;
  /** PIN を検証して承認する。正しければ true */
  requestOverride: (inputPin: string) => boolean;
  /** 承認を手動で取り消す */
  revokeOverride: () => void;
  /** 残り時間（ミリ秒）。無効時は 0 */
  remainingMs: number;
};

export function useAdminOverride(): AdminOverrideResult {
  const [active, setActive] = useState(() => readOverride());
  const [remainingMs, setRemainingMs] = useState(0);

  const configuredPin = readOptionalEnv('VITE_ADMIN_OVERRIDE_PIN') || DEFAULT_PIN;

  // 定期的に TTL チェック
  useEffect(() => {
    if (!active) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) { setActive(false); setRemainingMs(0); return; }
        const parsed = JSON.parse(raw) as Partial<OverridePayload>;
        if (!parsed || typeof parsed.expiresAt !== 'number') { setActive(false); setRemainingMs(0); return; }
        const remaining = parsed.expiresAt - Date.now();
        if (remaining <= 0) {
          sessionStorage.removeItem(STORAGE_KEY);
          setActive(false);
          setRemainingMs(0);
        } else {
          setRemainingMs(remaining);
        }
      } catch {
        setActive(false);
        setRemainingMs(0);
      }
    };

    tick();
    const interval = setInterval(tick, 10_000); // 10 秒ごと
    return () => clearInterval(interval);
  }, [active]);

  const requestOverride = useCallback(
    (inputPin: string): boolean => {
      if (inputPin.trim() === configuredPin) {
        writeOverride(DEFAULT_TTL_MS);
        setActive(true);
        return true;
      }
      return false;
    },
    [configuredPin],
  );

  const revokeOverride = useCallback(() => {
    clearOverride();
    setActive(false);
  }, []);

  return { isOverrideActive: active, requestOverride, revokeOverride, remainingMs };
}
