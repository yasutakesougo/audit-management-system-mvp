import { describe, expect, it } from 'vitest';

import {
  checkMissingInformation,
  classifyRecordQuality,
  findCategoryCandidates,
  getRecordQualityCategory,
  RECORD_QUALITY_CATEGORY_IDS,
  RECORD_QUALITY_TAXONOMY,
} from './recordQuality';

describe('recordQuality taxonomy fixtures', () => {
  it('初期カテゴリ14件を固定する', () => {
    expect(RECORD_QUALITY_CATEGORY_IDS).toEqual([
      'healthPhysicalCondition',
      'mealsHydration',
      'toileting',
      'sleepFatigue',
      'emotionAnxietyRegulation',
      'communicationRelationships',
      'activityParticipation',
      'workTasksRoles',
      'movementOutings',
      'incidentNearMiss',
      'familyExternalCommunication',
      'staffSupportActions',
      'environmentalFactors',
      'followUpConsiderations',
    ]);
    expect(RECORD_QUALITY_TAXONOMY).toHaveLength(14);
  });

  it('全カテゴリに説明、例となる手がかり、推測しない観点がある', () => {
    for (const category of RECORD_QUALITY_TAXONOMY) {
      expect(category.description).toBeTruthy();
      expect(category.exampleSignals.length).toBeGreaterThan(0);
      expect(category.doNotInfer.length).toBeGreaterThan(0);
    }
  });

  it('支援記録を複数の仕分け候補へ分類できる', () => {
    const candidates = findCategoryCandidates(
      '12:10から昼食。水分はコップ半分程度。職員が休憩を提案し、本人はうなずいた。',
    );

    expect(candidates.map(candidate => candidate.categoryId)).toEqual([
      'mealsHydration',
      'sleepFatigue',
      'communicationRelationships',
      'staffSupportActions',
    ]);
    expect(candidates[0].matchedSignals).toEqual(['昼食', '水分', 'コップ']);
  });

  it('事故やヒヤリを支援方針の確定ではなく仕分け候補として扱う', () => {
    const result = classifyRecordQuality({
      recordId: 'record-incident-1',
      text: '15:20、作業室で椅子につまずき転倒しかけた。職員が見守り、管理者へ報告した。',
    });

    expect(result.categoryCandidates.map(candidate => candidate.categoryId)).toContain(
      'incidentNearMiss',
    );
    expect(result.safety.requiresHumanReview).toBe(true);
    expect(result.safety.suggestionsOnly).toBe(true);
  });

  it('不足情報チェックであいまいな表現を具体化対象として検出する', () => {
    const checks = checkMissingInformation('午前、不安定。活動を拒否。');

    expect(checks).toContainEqual({
      code: 'concreteVagueExpression',
      label: 'あいまいな表現の具体化',
      present: false,
    });
    expect(checks).toContainEqual({
      code: 'staffSupportAction',
      label: '職員の支援内容',
      present: false,
    });
    expect(checks).toContainEqual({
      code: 'timing',
      label: '時刻や時間帯',
      present: true,
    });
  });

  it('原本を保持し、AI出力をレビュー用メタデータとして返す', () => {
    const originalText = '14:45、職員が外出前にトイレ確認。本人は「行く」と発言した。';
    const result = classifyRecordQuality({
      recordId: 'record-toilet-1',
      text: originalText,
    });

    expect(result.recordId).toBe('record-toilet-1');
    expect(result.originalText).toBe(originalText);
    expect(result.safety.outputKind).toBe('review-metadata');
    expect(result.safety.sourceOfTruth).toBe('original-support-record');
    expect(result.categoryCandidates.map(candidate => candidate.categoryId)).toContain('toileting');
  });

  it('安全ルールとして禁止操作を固定する', () => {
    const result = classifyRecordQuality({
      recordId: 'record-safety-1',
      text: '家族へ連絡。次回の会議で確認する。',
    });

    expect(result.safety.prohibitedActions).toEqual([
      'diagnoseUsers',
      'judgeBehavior',
      'overwriteOriginalRecord',
      'automaticallyDetermineSupportPolicy',
      'shareWithoutHumanApproval',
    ]);
    expect(result.safety.requiresHumanReview).toBe(true);
  });

  it('カテゴリIDからカテゴリを取得できる', () => {
    expect(getRecordQualityCategory('followUpConsiderations').label).toBe(
      'Follow-up considerations',
    );
  });
});
