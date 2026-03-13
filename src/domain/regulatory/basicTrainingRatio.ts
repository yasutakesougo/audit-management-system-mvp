/**
 * 基礎研修修了者比率 — 算出ロジック & スナップショット
 *
 * 生活支援員の実人数に対する基礎研修修了者の比率を算出し、
 * 監査根拠となるスナップショットを生成する。
 *
 * ## 重要な制度要件
 *
 * - **実人数**で算出する（常勤換算ではない）
 * - **非常勤も含む**
 * - 20%以上であること
 *
 * @see docs/design/severe-disability-addon-design.md
 */

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** 雇用形態 */
export type EmploymentType = 'full_time' | 'part_time';

/** 職種 — 比率算出の分母対象 */
export type StaffRole = 'life_support' | 'other';

/** 個別職員の算出根拠 */
export interface StaffDetail {
  /** 職員コード */
  staffId: string;
  /** 職員名 */
  staffName: string;
  /** 雇用形態 */
  employmentType: EmploymentType;
  /** 職種 */
  role: StaffRole;
  /** 基礎研修修了か */
  hasBasicTraining: boolean;
}

/** 基礎研修修了者比率のスナップショット — 監査根拠 */
export interface BasicTrainingRatioSnapshot {
  /** 算出日時（ISO 8601） */
  calculatedAt: string;
  /** 算出者（操作者 ID） */
  calculatedBy: string;

  // ── 分母: 生活支援員の実人数 ──

  /** 生活支援員の実人数（常勤+非常勤） */
  totalLifeSupportStaff: number;
  /** うち常勤 */
  fullTimeCount: number;
  /** うち非常勤 */
  partTimeCount: number;

  // ── 分子: 基礎研修修了者数 ──

  /** 基礎研修修了者数 */
  basicTrainingCompleted: number;

  // ── 判定結果 ──

  /** 比率（0.0〜1.0） */
  ratio: number;
  /** 20%以上を充足しているか */
  fulfilled: boolean;

  // ── 算出根拠（個別明細） ──

  /** 個別職員の明細 */
  staffDetails: StaffDetail[];
}

// ─────────────────────────────────────────────
// 算出関数
// ─────────────────────────────────────────────

/**
 * 全職員リストから基礎研修修了者比率のスナップショットを生成する
 *
 * @param allStaff 全職員の明細リスト
 * @param calculatedBy 算出者 ID
 * @param calculatedAt 算出日時。省略時は現在時刻。
 */
export function createBasicTrainingRatioSnapshot(
  allStaff: StaffDetail[],
  calculatedBy: string,
  calculatedAt?: string,
): BasicTrainingRatioSnapshot {
  // 生活支援員のみ抽出
  const lifeSupportStaff = allStaff.filter((s) => s.role === 'life_support');

  const totalLifeSupportStaff = lifeSupportStaff.length;
  const fullTimeCount = lifeSupportStaff.filter((s) => s.employmentType === 'full_time').length;
  const partTimeCount = lifeSupportStaff.filter((s) => s.employmentType === 'part_time').length;
  const basicTrainingCompleted = lifeSupportStaff.filter((s) => s.hasBasicTraining).length;

  const ratio = totalLifeSupportStaff > 0
    ? basicTrainingCompleted / totalLifeSupportStaff
    : 0;

  return {
    calculatedAt: calculatedAt ?? new Date().toISOString(),
    calculatedBy,
    totalLifeSupportStaff,
    fullTimeCount,
    partTimeCount,
    basicTrainingCompleted,
    ratio,
    fulfilled: ratio >= 0.20,
    staffDetails: lifeSupportStaff,
  };
}

/**
 * スナップショットを人間が読める日本語サマリに変換する
 *
 * 監査調書の出力や UI 表示に利用。
 */
export function formatRatioSummary(snapshot: BasicTrainingRatioSnapshot): string {
  const pct = (snapshot.ratio * 100).toFixed(1);
  const status = snapshot.fulfilled ? '✅ 充足' : '❌ 未充足';
  return [
    `基礎研修修了者比率: ${pct}%（${snapshot.basicTrainingCompleted}/${snapshot.totalLifeSupportStaff}人）${status}`,
    `  常勤: ${snapshot.fullTimeCount}人 / 非常勤: ${snapshot.partTimeCount}人`,
    `  算出日: ${snapshot.calculatedAt}`,
  ].join('\n');
}
