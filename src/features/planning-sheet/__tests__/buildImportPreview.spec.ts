/**
 * buildImportPreview.spec.ts — 差分プレビュー生成のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { buildImportPreview } from '../buildImportPreview';
import type { ImportPreviewItem } from '../buildImportPreview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyForm: Record<string, string> = {
  triggers: '',
  environmentFactors: '',
  emotions: '',
  cognition: '',
  needs: '',
  behaviorFunctionDetail: '',
};

const filledForm: Record<string, string> = {
  triggers: '既存のトリガー情報',
  environmentFactors: '既存の環境要因情報',
  emotions: '',
  cognition: '',
  needs: '',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildImportPreview', () => {
  it('空フォームに対してパッチを当てると全て new になる', () => {
    const patches: Record<string, string> = {
      triggers: '大きな音が苦手',
      environmentFactors: '騒がしい環境',
      emotions: '不安感が強い',
    };

    const result = buildImportPreview(patches, emptyForm);

    expect(result.items).toHaveLength(3);
    expect(result.items.every((i: ImportPreviewItem) => i.action === 'new')).toBe(true);
    expect(result.summary.newCount).toBe(3);
    expect(result.summary.appendCount).toBe(0);
    expect(result.summary.totalAffected).toBe(3);
  });

  it('既存値があるフィールドは append になる', () => {
    const patches: Record<string, string> = {
      triggers: '大きな音が苦手',
      environmentFactors: '新しい環境要因',
      emotions: '不安感',
    };

    const result = buildImportPreview(patches, filledForm);

    const triggersItem = result.items.find((i: ImportPreviewItem) => i.fieldKey === 'triggers');
    const envItem = result.items.find((i: ImportPreviewItem) => i.fieldKey === 'environmentFactors');
    const emotionsItem = result.items.find((i: ImportPreviewItem) => i.fieldKey === 'emotions');

    expect(triggersItem?.action).toBe('append');
    expect(triggersItem?.currentValue).toBe('既存のトリガー情報');
    expect(envItem?.action).toBe('append');
    expect(emotionsItem?.action).toBe('new');

    expect(result.summary.newCount).toBe(1);
    expect(result.summary.appendCount).toBe(2);
  });

  it('空文字のパッチはスキップされる', () => {
    const patches: Record<string, string> = {
      triggers: '大きな音が苦手',
      environmentFactors: '',
      emotions: '   ',
    };

    const result = buildImportPreview(patches, emptyForm);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].fieldKey).toBe('triggers');
  });

  it('フィールドラベルとセクションが正しく設定される', () => {
    const patches: Record<string, string> = {
      triggers: '刺激',
      behaviorFunctionDetail: '回避機能',
    };

    const result = buildImportPreview(patches, emptyForm);

    const triggersItem = result.items.find((i: ImportPreviewItem) => i.fieldKey === 'triggers');
    const fbaItem = result.items.find((i: ImportPreviewItem) => i.fieldKey === 'behaviorFunctionDetail');

    expect(triggersItem?.fieldLabel).toBe('トリガー（きっかけ）');
    expect(triggersItem?.section).toBe('§3 氷山分析');
    expect(fbaItem?.fieldLabel).toBe('機能の詳細分析');
    expect(fbaItem?.section).toBe('§4 FBA');
  });

  it('セクション順にソートされる', () => {
    const patches: Record<string, string> = {
      behaviorFunctionDetail: 'FBAデータ',
      triggers: 'トリガーデータ',
      environmentalAdjustment: '環境調整データ',
    };

    const result = buildImportPreview(patches, emptyForm);

    expect(result.items[0].section).toBe('§3 氷山分析');
    expect(result.items[1].section).toBe('§4 FBA');
    expect(result.items[2].section).toBe('§5 予防的支援');
  });

  it('FIELD_LABELS にないフィールドはスキップされる', () => {
    const patches: Record<string, string> = {
      triggers: 'データあり',
      unknownField: '未知のフィールド',
    };

    const result = buildImportPreview(patches, emptyForm);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].fieldKey).toBe('triggers');
  });

  it('パッチが空の場合、空の結果を返す', () => {
    const result = buildImportPreview({}, emptyForm);

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalAffected).toBe(0);
  });

  it('incomingValue は前後の空白がトリムされる', () => {
    const patches: Record<string, string> = {
      triggers: '  大きな音が苦手  ',
    };

    const result = buildImportPreview(patches, emptyForm);

    expect(result.items[0].incomingValue).toBe('大きな音が苦手');
  });
});
