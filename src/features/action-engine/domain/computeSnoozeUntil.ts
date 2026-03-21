// ---------------------------------------------------------------------------
// computeSnoozeUntil — snooze 解除日時を算出する pure function
//
// 3つのプリセットに対して ISO 8601 文字列を返す。
// タイムゾーンはローカル（ブラウザ）に委ねず、引数 `now` を基準にする。
// 週の始まりは月曜（ISO week）。end-of-week は日曜 23:59:59.999。
// ---------------------------------------------------------------------------

/**
 * snooze プリセット。
 *
 * - `tomorrow`   — 翌日 00:00:00 に解除
 * - `three-days` — 72時間後に解除
 * - `end-of-week` — 当該週の日曜 23:59:59.999 に解除（月曜始まり）
 */
export type SnoozePreset = 'tomorrow' | 'three-days' | 'end-of-week';

/** 全プリセットのラベル（UIで使用） */
export const SNOOZE_PRESET_LABELS: Record<SnoozePreset, string> = {
  tomorrow: '明日まで',
  'three-days': '3日後まで',
  'end-of-week': '今週末まで',
};

/**
 * snooze 解除日時を ISO 8601 文字列で返す。
 *
 * @param preset - snooze の種別
 * @param now - 基準日時（テスト用に外部注入可能）
 * @returns ISO 8601 日時文字列
 *
 * @example
 * ```ts
 * const until = computeSnoozeUntil('tomorrow', new Date('2026-03-21T10:00:00'));
 * // => '2026-03-22T00:00:00.000Z' (翌日の0時)
 * ```
 */
export function computeSnoozeUntil(preset: SnoozePreset, now: Date): string {
  switch (preset) {
    case 'tomorrow': {
      // 翌日 00:00:00.000
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }

    case 'three-days': {
      // 72 時間後
      const d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    }

    case 'end-of-week': {
      // 当該週の日曜 23:59:59.999（月曜始まり = ISO week）
      // day: 0=日, 1=月, ..., 6=土
      const d = new Date(now);
      const day = d.getDay();
      // 日曜(0)からの残り日数: 日=0, 月=6, 火=5, 水=4, 木=3, 金=2, 土=1
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      d.setDate(d.getDate() + daysUntilSunday);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }
  }
}
