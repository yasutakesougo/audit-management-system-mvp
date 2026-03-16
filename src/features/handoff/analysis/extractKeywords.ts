/**
 * 申し送りキーワード抽出 — Pure Function
 *
 * @description
 * HandoffRecord[] の message テキストから、福祉ドメインに特化した
 * キーワードを辞書ベースで抽出する。
 *
 * 設計方針:
 * - 形態素解析は使わない（ブラウザ環境の制約、実行速度優先）
 * - 辞書一致 + 否定表現除外 + 表記ゆれ正規化 で十分な精度を出す
 * - Pure Function: React / Hook / 外部API への依存ゼロ
 * - Phase 3 の LLM 入力としても使われる
 *
 * @see analysisTypes.ts — 出力型の定義
 */

import type {
  HandoffRecord,
  KeywordCategory,
  KeywordExtractionResult,
  KeywordHit,
} from './analysisTypes';

// ────────────────────────────────────────────────────────────
// 福祉ドメインキーワード辞書
// ────────────────────────────────────────────────────────────

/**
 * カテゴリ別キーワード辞書
 *
 * 追加ルール:
 * - 2文字以上のキーワードのみ（1文字だとノイズが多い）
 * - 複合語は分解せず登録（例: 食欲不振 → そのまま）
 * - 同義語はキーワード自体を複数登録ではなく SYNONYM_MAP で処理
 */
export const WELFARE_KEYWORDS: Record<KeywordCategory, readonly string[]> = {
  health: [
    '発熱', '嘔吐', '下痢', '食欲不振', '顔色', '咳', '服薬', '内服',
    'バイタル', '血圧', '体温', '脈拍', 'SpO2', '酸素', '痰', '浮腫',
    '倦怠感', '頭痛', '腹痛', '発疹', '便秘', '脱水', '低血糖',
    '感染', '陽性', '隔離', 'PCR', '抗原検査',
  ],
  behavior: [
    '不穏', 'パニック', '興奮', '他害', '自傷', '大声', 'こだわり',
    '拒否', '離席', '多動', '常同', '反復', '固執', 'パターン',
    '攻撃', '暴力', '破壊', '逃走', '飛び出し', '徘徊',
    'クールダウン', 'タイムアウト',
  ],
  family: [
    '家族', '保護者', '連絡帳', '面会', '外泊', '帰省',
    '母親', '父親', '兄弟', '姉妹', '後見人', '相談員',
    '受診', '通院', '入院', '退院',
  ],
  positive: [
    '笑顔', '参加', '意欲', '集中', '発語', '自発', '向上',
    '挑戦', '成功', '達成', '安定', '落ち着', '穏やか',
    'できた', '楽しそう', '嬉しそう', '協力', '交流',
  ],
  risk: [
    '転倒', '誤嚥', 'ヒヤリ', '骨折', '皮膚', '褥瘡', '脱水',
    'アレルギー', '窒息', '溺水', '火傷', '打撲', '擦り傷',
    '出血', '怪我', '事故', '緊急', '救急',
  ],
  daily: [
    '食事', '入浴', '排泄', '着替え', '歯磨き', '整容',
    '移動', '車椅子', '歩行', '送迎', '散歩', '作業',
    '昼食', '水分', 'トイレ', '睡眠', '午睡',
  ],
  support: [
    '声かけ', '見守り', '促し', '介助', '支援', '誘導',
    '環境調整', '視覚支援', 'スケジュール', '手順書',
    'SST', '構造化', 'TEACCH', 'ABA', 'PBS',
  ],
} as const;

// ────────────────────────────────────────────────────────────
// 表記ゆれ正規化マップ
// ────────────────────────────────────────────────────────────

/**
 * 同義語マップ: variant → normalized form
 *
 * value 側がキーワード辞書に登録されていること。
 * ここに登録した variant は、検索前にテキスト内で置換される。
 */
const SYNONYM_MAP: ReadonlyMap<string, string> = new Map([
  // 医療系（長い variant を先に登録）
  ['内服', '服薬'],
  ['お薬', '服薬'],
  ['吐いた', '嘔吐'],
  ['吐き気', '嘔吐'],
  ['熱がある', '発熱'],
  ['熱が出', '発熱'],
  ['お腹が痛', '腹痛'],
  ['頭が痛', '頭痛'],
  // 家族系
  ['お母さん', '母親'],
  ['お父さん', '父親'],
  ['ご家族', '家族'],
  ['御家族', '家族'],
  // 行動系
  ['暴れ', '興奮'],
  ['飛び出', '飛び出し'],
  // ポジティブ系
  ['ニコニコ', '笑顔'],
  ['上手にできた', '成功'],
  ['がんばっ', '挑戦'],
  ['頑張っ', '挑戦'],
]);

// ────────────────────────────────────────────────────────────
// ストップワード（除外語）
// ────────────────────────────────────────────────────────────

/**
 * キーワードとして意味をなさない高頻出語。
 * WELFARE_KEYWORDS に含まれていても、ストップワード側が優先する。
 */
const STOPWORDS = new Set([
  // 助動詞・助詞系
  'です', 'ます', 'した', 'あり', 'いる', 'される', 'なる',
  'こと', 'もの', 'ため', 'よう', 'ほう', 'とき', 'ところ',
  // 定型語
  '本日', '本人', '支援員', '利用者', '対象者', '職員',
  '午前中', '午後から', '以上', '以下', '特記',
  '確認', '報告', '連絡', '記録', '実施',
]);

// ────────────────────────────────────────────────────────────
// 否定表現パターン
// ────────────────────────────────────────────────────────────

/**
 * キーワードの直後に出現する否定表現パターン。
 * これがマッチした場合、そのキーワードヒットは無効とする。
 *
 * 例:
 *   「発熱なし」→ 発熱をヒットさせない
 *   「転倒は見られず」→ 転倒をヒットさせない
 */
const NEGATION_SUFFIXES = [
  'なし',
  'ない',
  'ありません',
  'ございません',
  '見られず',
  '認めず',
  '認められず',
  'なかった',
  'でした。なし',
  'はなし',
  'もなし',
  'せず',
  'しなかった',
] as const;

/**
 * キーワードの直前に出現する否定表現パターン。
 *
 * 例:
 *   「特に発熱等なし」→ 否定文脈
 */
const NEGATION_PREFIXES = [
  '特に',
  '特段',
] as const;

// ────────────────────────────────────────────────────────────
// テキスト正規化
// ────────────────────────────────────────────────────────────

/**
 * テキストを正規化する。
 *
 * - 全角英数字 → 半角
 * - 全角スペース → 半角
 * - 連続空白 → 単一空白
 * - HTML タグ除去（リッチテキスト対応）
 */
export function normalizeText(raw: string): string {
  let text = raw;

  // HTML タグ除去
  text = text.replace(/<[^>]*>/g, ' ');
  // 全角英数字 → 半角
  text = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  // 全角スペース → 半角
  text = text.replace(/\u3000/g, ' ');
  // 連続空白 → 単一空白
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}

/**
 * 同義語を正規化形に置換する。
 */
export function applySynonyms(text: string): string {
  let result = text;
  // 長い variant から先に置換（短い variant が長い variant の部分文字列にマッチする問題を防ぐ）
  const sortedEntries = [...SYNONYM_MAP.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [variant, normalized] of sortedEntries) {
    result = result.split(variant).join(normalized);
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// 否定判定
// ────────────────────────────────────────────────────────────

/**
 * テキスト内のキーワード出現位置が否定文脈かどうかを判定する。
 *
 * @param text 正規化済みテキスト
 * @param keyword 検索キーワード
 * @param position キーワードの出現開始位置
 * @returns true なら否定文脈（ヒットを無効にすべき）
 */
export function isNegated(text: string, keyword: string, position: number): boolean {
  const afterKeyword = text.substring(position + keyword.length);

  // キーワード直後の否定チェック（間に0〜2文字の接続語を許容）
  for (const suffix of NEGATION_SUFFIXES) {
    // 「発熱なし」「発熱はなし」「発熱等なし」「発熱もなし」
    const suffixPattern = new RegExp(`^.{0,3}${escapeRegex(suffix)}`);
    if (suffixPattern.test(afterKeyword)) {
      return true;
    }
  }

  // キーワード直前の否定プレフィックス + キーワード + 否定サフィックスの組み合わせ
  const beforeKeyword = text.substring(Math.max(0, position - 10), position);
  for (const prefix of NEGATION_PREFIXES) {
    if (beforeKeyword.includes(prefix)) {
      // 「特に」+ keyword の後ろに否定がある場合のみ否定
      for (const suffix of NEGATION_SUFFIXES) {
        if (afterKeyword.startsWith(suffix) || afterKeyword.match(new RegExp(`^.{0,2}${escapeRegex(suffix)}`))) {
          return true;
        }
      }
    }
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * 申し送りテキストからキーワードを抽出する。
 *
 * @param records 分析対象の申し送りレコード
 * @returns キーワードヒット結果（出現頻度降順）
 *
 * @example
 * ```ts
 * const result = extractKeywords(records);
 * // result.hits[0] → { keyword: '発熱', category: 'health', count: 5, ... }
 * ```
 */
export function extractKeywords(records: HandoffRecord[]): KeywordExtractionResult {
  // キーワード → 集計データ
  const hitMap = new Map<string, {
    category: KeywordCategory;
    handoffIds: Set<number>;
    userCodes: Set<string>;
    lastSeenAt: string;
  }>();

  for (const record of records) {
    // テキスト正規化
    const text = applySynonyms(normalizeText(record.message));

    // 各カテゴリのキーワードを検索
    for (const [category, keywords] of Object.entries(WELFARE_KEYWORDS) as [KeywordCategory, readonly string[]][]) {
      for (const keyword of keywords) {
        // ストップワードチェック
        if (STOPWORDS.has(keyword)) continue;

        // テキスト内の全出現を検索
        let searchFrom = 0;
        let matched = false;

        while (searchFrom < text.length) {
          const pos = text.indexOf(keyword, searchFrom);
          if (pos === -1) break;

          // 否定文脈チェック
          if (!isNegated(text, keyword, pos)) {
            matched = true;
          }

          searchFrom = pos + keyword.length;
        }

        // 1レコードにつき1回だけカウント（同一レコード内の重複は無視）
        if (matched) {
          const existing = hitMap.get(keyword);
          if (existing) {
            existing.handoffIds.add(record.id);
            existing.userCodes.add(record.userCode);
            if (record.createdAt > existing.lastSeenAt) {
              existing.lastSeenAt = record.createdAt;
            }
          } else {
            hitMap.set(keyword, {
              category,
              handoffIds: new Set([record.id]),
              userCodes: new Set([record.userCode]),
              lastSeenAt: record.createdAt,
            });
          }
        }
      }
    }
  }

  // Map → KeywordHit[] に変換、出現頻度降順でソート
  const hits: KeywordHit[] = [...hitMap.entries()]
    .map(([keyword, data]) => ({
      keyword,
      category: data.category,
      count: data.handoffIds.size,
      handoffIds: [...data.handoffIds],
      matchedUserCodes: [...data.userCodes],
      lastSeenAt: data.lastSeenAt,
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword, 'ja'));

  // カテゴリ別集計
  const byCategory: Record<KeywordCategory, number> = {
    health: 0,
    behavior: 0,
    family: 0,
    positive: 0,
    risk: 0,
    daily: 0,
    support: 0,
  };

  for (const hit of hits) {
    byCategory[hit.category] += hit.count;
  }

  return {
    hits,
    byCategory,
    totalRecordsAnalyzed: records.length,
  };
}

/** @internal テスト用エクスポート */
export const __test__ = {
  normalizeText,
  applySynonyms,
  isNegated,
  WELFARE_KEYWORDS,
  SYNONYM_MAP,
  STOPWORDS,
  NEGATION_SUFFIXES,
};
