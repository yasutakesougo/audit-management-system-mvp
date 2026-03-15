/**
 * tokuseiSignalExtractors.spec.ts — シグナル抽出レイヤーのユニットテスト
 *
 * 観点:
 * - 各 extract 関数の基本動作
 * - 空入力時の安全性
 * - キーワードマッチの精度
 * - 重複除去
 */
import { describe, expect, it } from 'vitest';
import type { TokuseiSourceNormalized } from '../tokuseiToPlanningBridge';
import { emptyNormalized } from '../tokuseiToPlanningBridge';
import {
  extractBehaviorSignals,
  extractChangeRigiditySignals,
  extractCommunicationSignals,
  extractContextAroundKeyword,
  extractMedicalSignals,
  extractSensorySignals,
  parseLabelList,
} from '../tokuseiSignalExtractors';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** emptyNormalized にパーシャルを上書きするヘルパー */
const withFields = (overrides: Partial<TokuseiSourceNormalized>): TokuseiSourceNormalized => ({
  ...emptyNormalized(),
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. extractSensorySignals
// ═══════════════════════════════════════════════════════════════════════════

describe('extractSensorySignals', () => {
  it('should detect hypersensitivity with coping strategy', () => {
    const source = withFields({
      hearing: '大きな音が苦手でイヤーマフをする',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].sense).toBe('hearing');
    expect(signals[0].level).toBe('hypersensitive');
    expect(signals[0].copingStrategies).toContain('イヤーマフ');
    expect(signals[0].confidence).toBe('high');
    expect(signals[0].suggestedTargets).toContain('sensoryTriggers');
    expect(signals[0].suggestedTargets).toContain('environmentalAdjustment');
  });

  it('should detect hypersensitivity without coping', () => {
    const source = withFields({
      touch: 'タグ付きの服が着られない',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('hypersensitive');
    expect(signals[0].copingStrategies).toEqual([]);
    expect(signals[0].suggestedTargets).not.toContain('environmentalAdjustment');
  });

  it('should detect hyposensitivity', () => {
    const source = withFields({
      smell: '匂いに気づかないことが多い',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('hyposensitive');
    expect(signals[0].copingStrategies).toEqual([]);
  });

  it('should return empty array for all-empty fields', () => {
    const signals = extractSensorySignals(emptyNormalized());
    expect(signals).toEqual([]);
  });

  it('should extract multiple senses simultaneously', () => {
    const source = withFields({
      hearing: '大きな音が苦手',
      vision: '蛍光灯のちらつきが辛い',
      touch: 'タグ付きの服が嫌',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(3);
    const kinds = signals.map((s) => s.sense);
    expect(kinds).toContain('hearing');
    expect(kinds).toContain('vision');
    expect(kinds).toContain('touch');
  });

  it('should deduplicate coping strategies from sensoryFreeText', () => {
    const source = withFields({
      hearing: '大きな音が苦手',
      sensoryFreeText: 'イヤーマフとイヤーマフを常時携帯',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    // Set-based dedup in findAllLabeled
    expect(signals[0].copingStrategies).toEqual(['イヤーマフ']);
  });

  it('should return unknown level for text without keywords', () => {
    const source = withFields({
      taste: '偏食がある',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].level).toBe('unknown');
    expect(signals[0].confidence).toBe('medium');
  });

  it('should find coping strategy from sensoryFreeText even when not in sense field', () => {
    const source = withFields({
      vision: '光が苦手',
      sensoryFreeText: 'サングラスを使うとよい',
    });
    const signals = extractSensorySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].copingStrategies).toContain('サングラス');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. extractCommunicationSignals
// ═══════════════════════════════════════════════════════════════════════════

describe('extractCommunicationSignals', () => {
  it('should infer visual/gesture modes from comprehension difficulty', () => {
    const source = withFields({
      comprehensionDifficulty: '視覚的な指示が必要。絵カードを使うと理解しやすい',
    });
    const signals = extractCommunicationSignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('comprehension');
    expect(signals[0].inferredModes).toContain('視覚的指示');
    expect(signals[0].inferredModes).toContain('視覚支援（絵カード）');
    expect(signals[0].suggestedTargets).toContain('communicationModes');
  });

  it('should infer gesture/card modes from expression difficulty', () => {
    const source = withFields({
      expressionDifficulty: '言葉で気持ちを伝えるのが難しい。指差しで伝えることが多い',
    });
    const signals = extractCommunicationSignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('expression');
    expect(signals[0].inferredModes).toContain('ジェスチャー（指差し）');
  });

  it('should return interaction signal', () => {
    const source = withFields({
      interactionDifficulty: '1対1なら会話できるが、集団だと黙る',
    });
    const signals = extractCommunicationSignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('interaction');
    expect(signals[0].inferredModes).toContain('1対1の環境');
  });

  it('should return empty array for empty fields', () => {
    const signals = extractCommunicationSignals(emptyNormalized());
    expect(signals).toEqual([]);
  });

  it('should give low confidence when no mode keywords are found', () => {
    const source = withFields({
      comprehensionDifficulty: '複雑な指示は難しい',
    });
    const signals = extractCommunicationSignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].inferredModes).toEqual([]);
    expect(signals[0].confidence).toBe('low');
    // hypothesis の素材にはなるので suggestedTargets に含まれる
    expect(signals[0].suggestedTargets).toContain('hypotheses');
  });

  it('should extract from all three fields simultaneously', () => {
    const source = withFields({
      comprehensionDifficulty: '絵カードが必要',
      expressionDifficulty: 'ジェスチャーで伝える',
      interactionDifficulty: '個別であれば可能',
    });
    const signals = extractCommunicationSignals(source);
    expect(signals).toHaveLength(3);
    expect(signals.map((s) => s.kind)).toEqual(['comprehension', 'expression', 'interaction']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. extractBehaviorSignals
// ═══════════════════════════════════════════════════════════════════════════

describe('extractBehaviorSignals', () => {
  it('should extract labels from behaviorMultiSelect', () => {
    const source = withFields({
      behaviorMultiSelect: '自傷、他害、離席',
    });
    const result = extractBehaviorSignals(source);
    expect(result).not.toBeNull();
    expect(result!.labels).toEqual(['自傷', '他害', '離席']);
    expect(result!.confidence).toBe('low'); // labels のみ → low
    expect(result!.suggestedTargets).toContain('targetBehaviors');
  });

  it('should extract operational hints from behaviorEpisodes', () => {
    const source = withFields({
      behaviorEpisodes: '休憩の終わりに離席を拒否する。大声で叫ぶこともある',
    });
    const result = extractBehaviorSignals(source);
    expect(result).not.toBeNull();
    expect(result!.rawEpisode).toBe('休憩の終わりに離席を拒否する。大声で叫ぶこともある');
    expect(result!.operationalHints.length).toBeGreaterThan(0);
    expect(result!.confidence).toBe('medium'); // episode あり → medium
    expect(result!.suggestedTargets).toContain('targetBehavior');
    expect(result!.suggestedTargets).toContain('presentingProblem');
  });

  it('should combine both multiselect and episodes', () => {
    const source = withFields({
      behaviorMultiSelect: '自傷、他害',
      behaviorEpisodes: '活動の切り替え時に自分の手を噛む',
    });
    const result = extractBehaviorSignals(source);
    expect(result).not.toBeNull();
    expect(result!.labels).toContain('自傷');
    expect(result!.labels).toContain('他害');
    expect(result!.operationalHints.length).toBeGreaterThan(0);
    expect(result!.suggestedTargets).toContain('targetBehaviors');
    expect(result!.suggestedTargets).toContain('targetBehavior');
  });

  it('should return null for empty fields', () => {
    const result = extractBehaviorSignals(emptyNormalized());
    expect(result).toBeNull();
  });

  it('should deduplicate labels', () => {
    const source = withFields({
      behaviorMultiSelect: '自傷、自傷、他害',
    });
    const result = extractBehaviorSignals(source);
    expect(result).not.toBeNull();
    expect(result!.labels).toEqual(['自傷', '他害']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. extractChangeRigiditySignals
// ═══════════════════════════════════════════════════════════════════════════

describe('extractChangeRigiditySignals', () => {
  it('should extract change-difficulty signal as trigger', () => {
    const source = withFields({
      difficultyWithChanges: '予定変更で泣いてしまう',
    });
    const signals = extractChangeRigiditySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('change-difficulty');
    expect(signals[0].rawText).toBe('予定変更で泣いてしまう');
    expect(signals[0].confidence).toBe('high');
    expect(signals[0].suggestedTargets).toContain('triggers');
    expect(signals[0].suggestedTargets).toContain('visualSupport');
  });

  it('should extract fixed-habit signal', () => {
    const source = withFields({
      fixedHabits: '毎日同じルートで通所しないと不安になる',
    });
    const signals = extractChangeRigiditySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('fixed-habit');
    expect(signals[0].suggestedTargets).toContain('triggers');
  });

  it('should extract repetitive-behavior as medium confidence', () => {
    const source = withFields({
      repetitiveBehaviors: '手を叩き続ける',
    });
    const signals = extractChangeRigiditySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('repetitive-behavior');
    expect(signals[0].confidence).toBe('medium');
    expect(signals[0].suggestedTargets).toContain('visualSupport');
  });

  it('should extract interest-in-parts signal', () => {
    const source = withFields({
      interestInParts: '換気扇の動きをずっと見ている',
    });
    const signals = extractChangeRigiditySignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('interest-in-parts');
    expect(signals[0].confidence).toBe('medium');
  });

  it('should return empty array for empty fields', () => {
    const signals = extractChangeRigiditySignals(emptyNormalized());
    expect(signals).toEqual([]);
  });

  it('should extract multiple signals simultaneously', () => {
    const source = withFields({
      difficultyWithChanges: '予定変更でパニック',
      fixedHabits: '決まった席でないと座れない',
      repetitiveBehaviors: '手を振る動作を繰り返す',
    });
    const signals = extractChangeRigiditySignals(source);
    expect(signals).toHaveLength(3);
    const kinds = signals.map((s) => s.kind);
    expect(kinds).toContain('change-difficulty');
    expect(kinds).toContain('fixed-habit');
    expect(kinds).toContain('repetitive-behavior');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. extractMedicalSignals
// ═══════════════════════════════════════════════════════════════════════════

describe('extractMedicalSignals', () => {
  it('should extract epilepsy and medication keywords', () => {
    const source = withFields({
      notes: 'てんかんの既往あり。服薬調整中',
    });
    const signals = extractMedicalSignals(source);
    expect(signals.length).toBeGreaterThanOrEqual(2);
    const keywords = signals.map((s) => s.keyword);
    expect(keywords).toContain('てんかん');
    expect(keywords).toContain('服薬');
  });

  it('should return empty array when no medical keywords found', () => {
    const source = withFields({
      notes: '好きな食べ物はカレーライス',
    });
    const signals = extractMedicalSignals(source);
    expect(signals).toEqual([]);
  });

  it('should return empty array when notes is empty', () => {
    const signals = extractMedicalSignals(emptyNormalized());
    expect(signals).toEqual([]);
  });

  it('should extract context around keyword', () => {
    const source = withFields({
      notes: '通院は月1回。てんかんのため発作時の対応手順あり',
    });
    const signals = extractMedicalSignals(source);
    const epilepsySignal = signals.find((s) => s.keyword === 'てんかん');
    expect(epilepsySignal).toBeDefined();
    expect(epilepsySignal!.context).toContain('てんかん');
    expect(epilepsySignal!.confidence).toBe('high');
  });

  it('should detect allergy keyword', () => {
    const source = withFields({
      notes: '卵アレルギーあり',
    });
    const signals = extractMedicalSignals(source);
    expect(signals).toHaveLength(1);
    expect(signals[0].keyword).toBe('アレルギー');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

describe('parseLabelList', () => {
  it('should parse comma-separated list', () => {
    expect(parseLabelList('自傷、他害、離席')).toEqual(['自傷', '他害', '離席']);
  });

  it('should parse semicolon-separated list', () => {
    expect(parseLabelList('自傷;他害;離席')).toEqual(['自傷', '他害', '離席']);
  });

  it('should return empty array for empty string', () => {
    expect(parseLabelList('')).toEqual([]);
  });

  it('should trim whitespace', () => {
    expect(parseLabelList(' 自傷 , 他害 ')).toEqual(['自傷', '他害']);
  });
});

describe('extractContextAroundKeyword', () => {
  it('should return the sentence containing the keyword', () => {
    const text = '通院は月1回。てんかんの薬を服用中。元気です';
    const context = extractContextAroundKeyword(text, 'てんかん');
    expect(context).toBe('てんかんの薬を服用中');
  });

  it('should return full text when keyword is in single sentence', () => {
    const text = 'てんかんの既往あり';
    const context = extractContextAroundKeyword(text, 'てんかん');
    expect(context).toBe('てんかんの既往あり');
  });
});
