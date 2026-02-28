export type TokuseiSurveyResponse = {
  id: number;
  responseId: string;
  responderName: string;
  responderEmail?: string;
  fillDate: string;
  targetUserName: string;
  guardianName?: string;
  relation?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  personality?: string;
  sensoryFeatures?: string;
  behaviorFeatures?: string;
  strengths?: string;
  notes?: string;
  createdAt: string;
};

export type TokuseiSurveySummary = {
  totalResponses: number;
  uniqueUsers: number;
  uniqueGuardians: number;
  latestSubmittedAt: string | null;
};

// ---------------------------------------------------------------------------
// SP Raw Row Type — Forms 設問単位の細分化列をすべて含む
// ---------------------------------------------------------------------------

/**
 * SharePoint FormsResponses_Tokusei リストの生データ型。
 * Forms の個別設問に対応する細分化フィールドを持つ。
 * フロントエンドのドメインモデル (TokuseiSurveyResponse) に変換するには
 * mapSpRowToTokuseiResponse() を使用する。
 */
export type SpTokuseiRawRow = {
  // -- 基本情報 --
  Id: number;
  ResponseId?: string;
  ResponderEmail?: string;
  ResponderName?: string;
  FillDate?: string;
  TargetUserName?: string;
  GuardianName?: string;
  Relation?: string;
  HeightCm?: string | number | null;
  WeightKg?: string | number | null;
  Strengths?: string;
  Notes?: string;
  Created?: string;

  // -- Forms メタ --
  FormRowId?: number;
  StartTime?: string;
  EndTime?: string;

  // -- 対人関係 --
  RelationalDifficulties?: string;
  SituationalUnderstanding?: string;

  // -- 感覚（5感別） --
  Hearing?: string;
  Vision?: string;
  Touch?: string;
  Smell?: string;
  Taste?: string;
  SensoryMultiSelect?: string;
  SensoryFreeText?: string;

  // -- こだわり --
  DifficultyWithChanges?: string;
  InterestInParts?: string;
  RepetitiveBehaviors?: string;
  FixedHabits?: string;

  // -- コミュニケーション --
  ComprehensionDifficulty?: string;
  ExpressionDifficulty?: string;
  InteractionDifficulty?: string;

  // -- 行動 --
  BehaviorMultiSelect?: string;
  BehaviorEpisodes?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const coerceNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

/** 数値フィールド (string | number | null) → number | null */
export const parseNumeric = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '').trim();
    if (!normalized) return null;
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const str = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value);
};

const optStr = (value: unknown): string | undefined => {
  const v = str(value);
  return v || undefined;
};

/**
 * ラベル付きで行を結合するヘルパー。
 * 空値はスキップされ、結果が空なら undefined を返す。
 */
const aggregateLabeled = (entries: [label: string, value: unknown][]): string | undefined => {
  const lines = entries
    .map(([label, value]) => {
      const v = str(value);
      return v ? `【${label}】${v}` : null;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : undefined;
};

// ---------------------------------------------------------------------------
// Parser: Aggregated string → Structured entries (for UI rendering)
// ---------------------------------------------------------------------------

/** Structured entry parsed from an aggregated feature string. */
export type FeatureEntry = {
  label: string;
  content: string;
};

/**
 * Parses an aggregated feature string (produced by `aggregateLabeled`) back
 * into structured entries for chip-based UI rendering.
 *
 * Input format: `【ラベル1】内容1\n【ラベル2】内容2`
 * Output: `[{ label: 'ラベル1', content: '内容1' }, ...]`
 *
 * Lines that don't match the `【...】` pattern are treated as unlabeled entries
 * with label '情報'.
 */
export const parseAggregatedFeatures = (value: string | undefined): FeatureEntry[] => {
  if (!value) return [];
  const PATTERN = /^【([^】]+)】(.+)$/;
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = PATTERN.exec(line);
      if (match) {
        return { label: match[1], content: match[2].trim() };
      }
      return { label: '情報', content: line };
    });
};

// ---------------------------------------------------------------------------
// Adapter: SP Raw → Domain
// ---------------------------------------------------------------------------

/**
 * SP の細分化列をドメインモデルの集約フィールドに変換する。
 *
 * 変換ルール:
 * - personality: RelationalDifficulties + SituationalUnderstanding を集約
 * - sensoryFeatures: 5感別列 + SensoryMultiSelect + SensoryFreeText を集約
 * - behaviorFeatures:
 *     こだわり (DifficultyWithChanges, InterestInParts, RepetitiveBehaviors, FixedHabits)
 *   + コミュニケーション (ComprehensionDifficulty, ExpressionDifficulty, InteractionDifficulty)
 *   + 行動 (BehaviorMultiSelect, BehaviorEpisodes)
 *   を集約
 */
export const mapSpRowToTokuseiResponse = (row: SpTokuseiRawRow): TokuseiSurveyResponse => {
  const idRaw = row.Id;
  const id = typeof idRaw === 'number' && Number.isFinite(idRaw) ? idRaw : 0;

  return {
    id,
    responseId: str(row.ResponseId),
    responderName: str(row.ResponderName),
    responderEmail: optStr(row.ResponderEmail),
    fillDate: str(row.FillDate ?? row.Created ?? ''),
    targetUserName: str(row.TargetUserName),
    guardianName: optStr(row.GuardianName),
    relation: optStr(row.Relation),
    heightCm: parseNumeric(row.HeightCm),
    weightKg: parseNumeric(row.WeightKg),

    // 集約: 対人関係 → personality
    personality: aggregateLabeled([
      ['対人関係の難しさ', row.RelationalDifficulties],
      ['状況理解の難しさ', row.SituationalUnderstanding],
    ]),

    // 集約: 5感別 + 自由記述 → sensoryFeatures
    sensoryFeatures: aggregateLabeled([
      ['聴覚', row.Hearing],
      ['視覚', row.Vision],
      ['触覚', row.Touch],
      ['嗅覚', row.Smell],
      ['味覚', row.Taste],
      ['該当する感覚', row.SensoryMultiSelect],
      ['感覚の詳細', row.SensoryFreeText],
    ]),

    // 集約: こだわり + コミュニケーション + 行動 → behaviorFeatures
    behaviorFeatures: aggregateLabeled([
      ['変化への対応困難', row.DifficultyWithChanges],
      ['物の一部への興味', row.InterestInParts],
      ['繰り返し行動', row.RepetitiveBehaviors],
      ['習慣への固執', row.FixedHabits],
      ['理解の困難', row.ComprehensionDifficulty],
      ['発信の困難', row.ExpressionDifficulty],
      ['やり取りの困難', row.InteractionDifficulty],
      ['該当する行動', row.BehaviorMultiSelect],
      ['行動エピソード', row.BehaviorEpisodes],
    ]),

    strengths: optStr(row.Strengths),
    notes: optStr(row.Notes),
    createdAt: str(row.Created),
  };
};

export const summarizeTokuseiResponses = (responses: TokuseiSurveyResponse[]): TokuseiSurveySummary => {
  if (!responses.length) {
    return {
      totalResponses: 0,
      uniqueUsers: 0,
      uniqueGuardians: 0,
      latestSubmittedAt: null,
    };
  }

  const uniqueUsers = new Set<string>();
  const uniqueGuardians = new Set<string>();
  let latestSubmittedAt: string | null = null;

  for (const response of responses) {
    if (response.targetUserName) {
      uniqueUsers.add(response.targetUserName);
    }
    if (response.guardianName) {
      uniqueGuardians.add(response.guardianName);
    }
    if (!latestSubmittedAt || response.fillDate > latestSubmittedAt) {
      latestSubmittedAt = response.fillDate;
    }
  }

  return {
    totalResponses: responses.length,
    uniqueUsers: uniqueUsers.size,
    uniqueGuardians: uniqueGuardians.size,
    latestSubmittedAt,
  };
};

export const createTokuseiDemoResponses = (): TokuseiSurveyResponse[] => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: 1,
      responseId: 'TOKUSEI-001',
      responderName: '山田花子',
      responderEmail: 'hanako.yamada@example.com',
      fillDate: new Date(now - dayMs).toISOString(),
      targetUserName: 'Aさん',
      guardianName: '山田太郎',
      relation: '母',
      heightCm: coerceNumber(148),
      weightKg: coerceNumber(42),
      personality: '初めての環境では緊張が強いが、慣れると自分から話しかけられる明るさがあります。',
      sensoryFeatures: '大きな音と蛍光灯のちらつきが苦手。イヤーマフで落ち着ける。',
      behaviorFeatures: '予定外の変更で泣いてしまうことあり。視覚スケジュールで予告すると安定。',
      strengths: '手先が器用でビーズ作りが得意。小さい子のお世話が上手。',
      notes: '配慮が必要な場面：集団活動の開始時。個別に声をかけると入りやすい。',
      createdAt: new Date(now - dayMs * 0.9).toISOString(),
    },
    {
      id: 2,
      responseId: 'TOKUSEI-002',
      responderName: '佐藤一郎',
      responderEmail: 'ichiro.sato@example.com',
      fillDate: new Date(now - dayMs * 3).toISOString(),
      targetUserName: 'Bさん',
      guardianName: '佐藤花',
      relation: '父',
      heightCm: coerceNumber(160),
      weightKg: coerceNumber(50),
      personality: 'マイペースでこだわり強め。信頼できる人には冗談を交えながら話す。',
      sensoryFeatures: '触覚過敏でタグ付きの服が苦手。加圧ベストで安心できる。',
      behaviorFeatures: '気持ちの切り替えに時間がかかる。シークエンスボードで見通しを示すと前向き。',
      strengths: '記憶力が非常に高く、ダイヤ改正の情報にも詳しい。',
      notes: '外出時は混雑を避けるルート設定を希望。',
      createdAt: new Date(now - dayMs * 2.9).toISOString(),
    },
    {
      id: 3,
      responseId: 'TOKUSEI-003',
      responderName: '高橋美咲',
      responderEmail: 'misaki.takahashi@example.com',
      fillDate: new Date(now - dayMs * 6).toISOString(),
      targetUserName: 'Cさん',
      guardianName: '高橋陽子',
      relation: '姉',
      heightCm: coerceNumber(152),
      weightKg: coerceNumber(47),
      personality: '周囲を観察してから動く慎重派。信頼関係ができると率先して手伝ってくれる。',
      sensoryFeatures: '匂いに敏感で、調理室付近ではマスクをしたい。',
      behaviorFeatures: '疲れると黙り込むので、短い休憩を挟むと復活。',
      strengths: '人を気遣う声かけが自然にできる。',
      notes: '面談時は女性スタッフ希望。',
      createdAt: new Date(now - dayMs * 5.8).toISOString(),
    },
  ];
};
