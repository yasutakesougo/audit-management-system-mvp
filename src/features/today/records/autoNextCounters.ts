/**
 * autoNextCounters — auto-next 利用統計の軽量カウンター
 *
 * localStorage に以下を保持:
 * - ams_today_autonext_save_count:  auto-next で保存した総回数
 * - ams_today_autonext_session_count: 現在のセッションでの保存回数
 * - ams_today_autonext_complete_count: キュー全完了回数
 * - ams_today_autonext_last_used: 最終利用日時 (ISO)
 *
 * 例外安全: Storage アクセス不可でもアプリはクラッシュしない。
 *
 * @see Issue #632
 */

const KEYS = {
  SAVE_COUNT: 'ams_today_autonext_save_count',
  SESSION_SAVES: 'ams_today_autonext_session_saves',
  COMPLETE_COUNT: 'ams_today_autonext_complete_count',
  LAST_USED: 'ams_today_autonext_last_used',
} as const;

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function safeReadNumber(key: string): number {
  const raw = safeRead(key);
  if (raw == null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/** auto-next で1件保存したときに呼ぶ */
export function recordAutoNextSave(): void {
  const total = safeReadNumber(KEYS.SAVE_COUNT) + 1;
  const session = safeReadNumber(KEYS.SESSION_SAVES) + 1;
  safeWrite(KEYS.SAVE_COUNT, String(total));
  safeWrite(KEYS.SESSION_SAVES, String(session));
  safeWrite(KEYS.LAST_USED, new Date().toISOString());
}

/** キュー全完了時に呼ぶ */
export function recordAutoNextComplete(): void {
  const count = safeReadNumber(KEYS.COMPLETE_COUNT) + 1;
  safeWrite(KEYS.COMPLETE_COUNT, String(count));
  // セッション内カウントはリセット
  safeWrite(KEYS.SESSION_SAVES, '0');
}

/** 現在のカウンターを取得（Debug/Settings パネル用） */
export function getAutoNextCounters(): {
  totalSaves: number;
  sessionSaves: number;
  completeCount: number;
  lastUsed: string | null;
} {
  return {
    totalSaves: safeReadNumber(KEYS.SAVE_COUNT),
    sessionSaves: safeReadNumber(KEYS.SESSION_SAVES),
    completeCount: safeReadNumber(KEYS.COMPLETE_COUNT),
    lastUsed: safeRead(KEYS.LAST_USED),
  };
}

/** カウンターを全リセット（テスト / Debug 用） */
export function resetAutoNextCounters(): void {
  Object.values(KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}
