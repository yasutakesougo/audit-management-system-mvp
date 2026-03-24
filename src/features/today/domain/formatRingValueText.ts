/**
 * formatRingValueText — ProgressRing の表示テキストを生成する純粋関数
 *
 * リング種別ごとに最適な表示形式を選択する:
 * - records / caseRecords → 「あとN件」（行動促進）/ 「完了」
 * - attendance → 「N/N」（率表示が自然）
 * - contacts → 「N件」（件数モード、既存踏襲）
 *
 * ⚠️ UI コンポーネント内の分岐を最小化するために抽出。
 * ⚠️ status 判定ロジックには関与しない。
 */

// ─── Types ───────────────────────────────────────────────────

export type RingKey = 'records' | 'caseRecords' | 'attendance' | 'contacts';

export type RingValueTextInput = {
  key: RingKey;
  completed: number;
  total: number;
};

// ─── Logic ───────────────────────────────────────────────────

/**
 * リング種別に応じた表示テキストを生成する。
 *
 * @returns valueText — リング中央に表示する短いテキスト
 */
export function formatRingValueText(input: RingValueTextInput): string {
  const { key, completed, total } = input;

  switch (key) {
    case 'records':
    case 'caseRecords': {
      // 残数表示（行動促進）
      if (total <= 0) return '–';
      const remaining = Math.max(0, total - completed);
      if (remaining === 0) return '完了';
      return `あと${remaining}`;
    }

    case 'attendance': {
      // 出席率は分数が自然
      if (total <= 0) return '–';
      return `${completed}/${total}`;
    }

    case 'contacts': {
      // 件数モード（total = count）
      return `${completed}件`;
    }

    default:
      return `${completed}/${total}`;
  }
}

/**
 * リング種別に応じた補助テキストを生成する。
 * status ラベルの代わりに、より行動に近い情報を表示する。
 *
 * @returns subText — リング下部に表示する短いテキスト（optional）
 */
export function formatRingSubText(
  key: RingKey,
  completed: number,
  total: number,
): string | null {
  switch (key) {
    case 'records':
    case 'caseRecords': {
      if (total <= 0) return null;
      const remaining = Math.max(0, total - completed);
      if (remaining === 0) return '完了';
      // 分母情報を補助テキストに
      return `${completed}/${total}`;
    }

    case 'attendance': {
      if (total <= 0) return null;
      const absent = Math.max(0, total - completed);
      if (absent === 0) return '全員出席';
      return `欠${absent}`;
    }

    case 'contacts':
      return completed === 0 ? '対応済' : null;

    default:
      return null;
  }
}
