/**
 * @fileoverview 編集用 UserRowData ↔ 保存用 DailyTableRecord の変換 mapper
 *
 * @description
 * 「編集モデル」と「保存モデル」の分離点を明文化する。
 *
 * 変換責務:
 * - lunchAmount 文字列 → LunchIntake 型への正規化
 * - problemBehavior フラグ群 → ProblemBehaviorType[] 配列への変換
 * - 空文字トリム
 * - 逆変換（将来の履歴表示・プリフィル用）
 *
 * このモジュールは React / hook に依存しない pure function のみで構成する。
 */

import type { UserRowData } from '../hooks/useTableDailyRecordForm';
import type {
  DailyTableRecord,
  LunchIntake,
  ProblemBehaviorType,
} from '../infra/dailyTableRepository';

// ─── Types ──────────────────────────────────────────────

export type SaveContext = {
  /** 記録対象日 (YYYY-MM-DD) */
  date: string;
  /** 記録者情報 */
  reporter: { name: string; role: string };
  /** 提出日時 (ISO) */
  submittedAt: string;
};

// ─── Primitive Converters ───────────────────────────────

const VALID_LUNCH_VALUES: readonly LunchIntake[] = [
  'full',
  '80',
  'half',
  'small',
  'none',
] as const;

/**
 * 文字列 → LunchIntake 正規化
 *
 * 有効な LunchIntake 値でなければ undefined を返す。
 */
export function toLunchIntake(raw: string): LunchIntake | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return (VALID_LUNCH_VALUES as readonly string[]).includes(trimmed)
    ? (trimmed as LunchIntake)
    : undefined;
}

/**
 * フラグオブジェクト → ProblemBehaviorType[] 変換
 *
 * @description
 * UI の boolean フラグ名と API の ProblemBehaviorType には差異があるため、
 * ここで名前のマッピングも担う。
 *
 * UI flag       → API type
 * selfHarm      → 'selfHarm'
 * otherInjury   → 'otherInjury'
 * loudVoice     → 'shouting'  ← 名前が異なる
 * pica          → 'pica'
 * other         → 'other'
 */
const FLAG_TO_TYPE_MAP: Record<string, ProblemBehaviorType> = {
  selfHarm: 'selfHarm',
  otherInjury: 'otherInjury',
  loudVoice: 'shouting',
  pica: 'pica',
  other: 'other',
};

const TYPE_TO_FLAG_MAP: Record<ProblemBehaviorType, string> = {
  selfHarm: 'selfHarm',
  otherInjury: 'otherInjury',
  shouting: 'loudVoice',
  pica: 'pica',
  other: 'other',
};

export function toProblemBehaviorTypes(
  pb: UserRowData['problemBehavior'],
): ProblemBehaviorType[] {
  const types: ProblemBehaviorType[] = [];

  for (const [flag, enabled] of Object.entries(pb)) {
    if (enabled && FLAG_TO_TYPE_MAP[flag]) {
      types.push(FLAG_TO_TYPE_MAP[flag]);
    }
  }

  return types;
}

export function fromProblemBehaviorTypes(
  types: ProblemBehaviorType[],
): UserRowData['problemBehavior'] {
  const pb: UserRowData['problemBehavior'] = {
    selfHarm: false,
    otherInjury: false,
    loudVoice: false,
    pica: false,
    other: false,
  };

  for (const type of types) {
    const flag = TYPE_TO_FLAG_MAP[type];
    if (flag && flag in pb) {
      (pb as Record<string, boolean>)[flag] = true;
    }
  }

  return pb;
}

// ─── Record Converters ──────────────────────────────────

/**
 * 編集用 UserRowData → 保存用 DailyTableRecord 変換
 *
 * 正規化責務:
 * - lunchAmount 文字列 → LunchIntake 型
 * - problemBehavior フラグ群 → ProblemBehaviorType[] 配列
 * - specialNotes → notes（キー名変換 + トリム）
 * - 空文字は undefined に正規化
 */
export function toDailyTableRecord(
  row: UserRowData,
  context: SaveContext,
): DailyTableRecord {
  const am = row.amActivity.trim() || undefined;
  const pm = row.pmActivity.trim() || undefined;
  const notes = row.specialNotes.trim() || undefined;
  const lunch = toLunchIntake(row.lunchAmount);
  const behaviors = toProblemBehaviorTypes(row.problemBehavior);
  const tags = row.behaviorTags.length > 0 ? [...row.behaviorTags] : undefined;

  return {
    userId: row.userId,
    recordDate: context.date,
    activities: { am, pm },
    lunchIntake: lunch,
    problemBehaviors: behaviors.length > 0 ? behaviors : undefined,
    behaviorTags: tags,
    notes,
    submittedAt: context.submittedAt,
    authorName: context.reporter.name || undefined,
    authorRole: context.reporter.role || undefined,
  };
}

/**
 * 保存用 DailyTableRecord → 編集用 UserRowData 逆変換
 * （将来のプリフィルや履歴表示に使用）
 */
export function fromDailyTableRecord(
  record: DailyTableRecord,
): UserRowData {
  return {
    userId: record.userId,
    userName: record.authorName ?? record.userId,
    amActivity: record.activities.am ?? '',
    pmActivity: record.activities.pm ?? '',
    lunchAmount: record.lunchIntake ?? '',
    problemBehavior: fromProblemBehaviorTypes(record.problemBehaviors ?? []),
    specialNotes: record.notes ?? '',
    behaviorTags: record.behaviorTags ? [...record.behaviorTags] : [],
  };
}
