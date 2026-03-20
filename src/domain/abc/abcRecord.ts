/**
 * ABC Record — ドメイン型 & リポジトリポート
 *
 * 強度行動障害支援のための ABC（Antecedent-Behavior-Consequence）記録。
 * 日常の行動観察データを収集し、氷山 PDCA → 支援計画へ集約する。
 *
 * @see src/domain/isp/schema.ts — abcEventSchema（支援計画内の要約版）
 */

// ─────────────────────────────────────────────
// Value types
// ─────────────────────────────────────────────

export const ABC_INTENSITY_VALUES = ['low', 'medium', 'high'] as const;
export type AbcIntensity = (typeof ABC_INTENSITY_VALUES)[number];

export const ABC_INTENSITY_DISPLAY: Record<AbcIntensity, string> = {
  low: '軽度',
  medium: '中度',
  high: '重度',
} as const;

// ─────────────────────────────────────────────
// Source context (どの画面から作成されたか)
// ─────────────────────────────────────────────

/** ABC 記録の作成元コンテキスト */
export interface AbcRecordSourceContext {
  /** 作成元画面 */
  source: 'daily-support' | 'standalone';
  /** 支援計画 ID（将来の逆引き用） */
  planId?: string;
  /** 時間帯スロットキー (例: "09:00|朝の受け入れ") */
  slotId?: string;
  /** 対象日 (YYYY-MM-DD) */
  date?: string;
}

// ─────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────

export interface AbcRecord {
  /** 一意 ID（生成は infra 層） */
  id: string;
  /** 利用者 ID */
  userId: string;
  /** 利用者名（検索・表示用スナップショット） */
  userName: string;
  /** 発生日時 ISO string */
  occurredAt: string;
  /** 発生場面 */
  setting: string;
  /** A: 先行事象（Antecedent） */
  antecedent: string;
  /** B: 行動（Behavior） */
  behavior: string;
  /** C: 結果（Consequence） */
  consequence: string;
  /** 強度 */
  intensity: AbcIntensity;
  /** 継続時間（分） */
  durationMinutes: number | null;
  /** 危険行動フラグ */
  riskFlag: boolean;
  /** 記録者名 */
  recorderName: string;
  /** タグ（行動カテゴリなど） */
  tags: string[];
  /** メモ */
  notes: string;
  /** 作成日時 */
  createdAt: string;
  /** 作成元コンテキスト（daily-support 起源の場合に設定） */
  sourceContext?: AbcRecordSourceContext;
}

export type AbcRecordCreateInput = Omit<AbcRecord, 'id' | 'createdAt'>;

// ─────────────────────────────────────────────
// Repository port
// ─────────────────────────────────────────────

export interface AbcRecordRepository {
  /** 保存（新規 or 更新） */
  save(record: AbcRecordCreateInput): Promise<AbcRecord>;
  /** 既存レコードの更新 */
  update(id: string, fields: Partial<AbcRecordCreateInput>): Promise<AbcRecord | null>;
  /** 全件取得（新しい順） */
  getAll(): Promise<AbcRecord[]>;
  /** 利用者 ID で絞り込み */
  getByUserId(userId: string): Promise<AbcRecord[]>;
  /** ID で1件取得 */
  getById(id: string): Promise<AbcRecord | null>;
  /** 削除 */
  delete(id: string): Promise<void>;
}
