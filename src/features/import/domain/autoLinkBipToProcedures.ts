// ---------------------------------------------------------------------------
// autoLinkBipToProcedures — 自動クロスリンク
//
// ProcedureItem（時間割）と BehaviorInterventionPlan（BIP）を
// キーワードマッチングで自動紐付けする純粋関数。
//
// CSVインポート時に呼び出して linkedInterventionIds を自動付与。
// ---------------------------------------------------------------------------
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';

// ---------------------------------------------------------------------------
// 同義語辞書（MVP版）
//
// 「紙切り」と「はさみ」のように、時間割と注意事項で異なる表現が使われる
// ケースに対応するための最小限の辞書。
// ---------------------------------------------------------------------------

const SYNONYM_GROUPS: readonly string[][] = [
  ['はさみ', '紙切り', 'ハサミ', '切る'],
  ['食事', '昼食', '給食', '食堂', '配膳', '誤嚥'],
  ['入浴', 'お風呂', '風呂', 'シャワー', '着替え', '更衣'],
  ['トイレ', '排泄', 'おむつ', 'パッド'],
  ['送迎', '車', 'バス', '乗車', '降車'],
  ['パニック', 'パニクる', '興奮', '大声', '叫ぶ', '泣く'],
  ['離席', '立ち歩き', '飛び出し', '逃走', '飛び出す'],
  ['他害', '叩く', '噛む', '引っ掻く', '投げる', '蹴る', '暴力'],
  ['自傷', '頭を打つ', '壁に頭', '手を噛む'],
  ['破壊', '壊す', '破く', '物を投げる', '物品'],
  ['こだわり', '固執', 'ルーティン', '儀式'],
  ['騒音', 'うるさい', '音', '聴覚過敏', 'イヤーマフ'],
  ['見通し', 'スケジュール', '予定', '絵カード', '視覚支援'],
];

/** 同義語辞書から、各単語が所属するグループのインデックスマップを構築 */
function buildSynonymIndex(): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let gi = 0; gi < SYNONYM_GROUPS.length; gi++) {
    for (const word of SYNONYM_GROUPS[gi]) {
      const key = word.toLowerCase();
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push(gi);
    }
  }
  return index;
}

const synonymIndex = buildSynonymIndex();

/**
 * テキストから同義語グループのインデックス集合を抽出する。
 */
function extractSynonymGroupIds(text: string): Set<number> {
  const groups = new Set<number>();
  const lower = text.toLowerCase();
  for (const [word, groupIds] of synonymIndex) {
    if (lower.includes(word)) {
      for (const gid of groupIds) {
        groups.add(gid);
      }
    }
  }
  return groups;
}

/**
 * 2つの同義語グループ集合に共通する要素があるかチェック。
 */
function hasOverlap(a: Set<number>, b: Set<number>): boolean {
  for (const id of a) {
    if (b.has(id)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * ProcedureItem と BIP をキーワードマッチングで自動クロスリンクする。
 *
 * マッチング戦略:
 * 1. BIP のテキスト（targetBehavior + strategies.prevention）からキーワードを抽出
 * 2. ProcedureItem のテキスト（activity + instruction）からキーワードを抽出
 * 3. 直接キーワード一致 + 同義語辞書で完全一致を検出
 * 4. マッチした BIP の ID を linkedInterventionIds に追加
 *
 * @param procedures - リンクされる時間割アイテム（コピーが返される）
 * @param plans - 紐付け候補の BIP 配列
 * @returns linkedInterventionIds が付与された新しい ProcedureItem 配列
 *
 * @example
 * ```ts
 * const linked = autoLinkBipToProcedures(procedures, plans);
 * // 「昼休み - 紙切り」に BIP「はさみへのこだわり」が自動リンク
 * ```
 */
export function autoLinkBipToProcedures(
  procedures: ScheduleItem[],
  plans: BehaviorInterventionPlan[],
): ScheduleItem[] {
  if (plans.length === 0) return procedures;

  // 各 BIP のテキストから同義語グループを事前計算
  const planGroups = plans.map((plan) => {
    const text = [
      plan.targetBehavior,
      plan.strategies.prevention,
      plan.strategies.alternative,
      plan.strategies.reactive,
      ...plan.triggerFactors.map((f) => f.label),
    ].join(' ');
    return {
      id: plan.id,
      groups: extractSynonymGroupIds(text),
      textLower: text.toLowerCase(),
    };
  });

  return procedures.map((proc) => {
    const procText = `${proc.activity} ${proc.instruction}`.toLowerCase();
    const procGroups = extractSynonymGroupIds(`${proc.activity} ${proc.instruction}`);

    const matches: string[] = [];

    for (const pg of planGroups) {
      // ストラテジー1: 同義語グループの重複チェック
      if (hasOverlap(procGroups, pg.groups)) {
        matches.push(pg.id);
        continue;
      }

      // ストラテジー2: BIP テキストに手順のキーワードが含まれるか
      // activity の各単語（2文字以上）を BIP テキスト内で直接検索
      const words = proc.activity
        .split(/[\s\-・,、。/／()（）]+/)
        .filter((w) => w.length >= 2);
      const directMatch = words.some((w) => pg.textLower.includes(w.toLowerCase()));
      if (directMatch) {
        matches.push(pg.id);
        continue;
      }

      // ストラテジー3: BIP targetBehavior が手順テキストに含まれるか
      if (procText.includes(pg.textLower.slice(0, 10).toLowerCase()) && pg.textLower.length > 0) {
        matches.push(pg.id);
      }
    }

    if (matches.length === 0) return proc;

    // 既存の linkedInterventionIds とマージ（重複排除）
    const existing = new Set(proc.linkedInterventionIds ?? []);
    for (const id of matches) existing.add(id);

    return {
      ...proc,
      linkedInterventionIds: [...existing],
    };
  });
}
