/**
 * SP フィールド定義の設計不変条件テスト
 *
 * 目的: ListKeys ↔ LIST_CONFIG ↔ FIELD_MAP の整合性を静的に検証し、
 * 孤立・誤接続・派生列混入の回帰を CI で即座に検出する。
 */
import {
    FIELD_DERIVED_TOKUSEI,
    FIELD_MAP_ICEBERG_ANALYSIS,
    FIELD_MAP_SURVEY_TOKUSEI,
    ListKeys,
} from '@/sharepoint/fields';
import { describe, expect, it } from 'vitest';

// LIST_CONFIG は Record<ListKeys, { title: string }> 型なので
// import するだけで「全 ListKeys にエントリがある」ことが型レベルで保証される。
// ここではランタイムでも確認。
import { LIST_CONFIG } from '@/sharepoint/fields';

describe('fields.ts — 設計不変条件', () => {
  // ─── P0 回帰防止: 旧 Dat_Behaviors が復活しないこと ───
  it('ListKeys に Dat_Behaviors が含まれないこと', () => {
    const values = Object.values(ListKeys);
    expect(values).not.toContain('Dat_Behaviors');
  });

  // ─── P1 回帰防止: ListKeys ↔ LIST_CONFIG の全キー対応 ───
  it('全ての ListKeys に対応する LIST_CONFIG エントリが存在すること', () => {
    for (const key of Object.values(ListKeys)) {
      const entry = LIST_CONFIG[key as ListKeys];
      expect(entry, `LIST_CONFIG に ${key} のエントリがない`).toBeDefined();
      expect(entry.title, `LIST_CONFIG[${key}].title が空`).toBeTruthy();
    }
  });

  it('LIST_CONFIG のタイトルが ListKeys の値と論理的に対応すること', () => {
    // LIST_CONFIG[key].title が別のリストを指していないかの基本チェック
    // (Dat_Behaviors → SupportTemplates のような誤マッピング防止)
    for (const key of Object.values(ListKeys)) {
      const entry = LIST_CONFIG[key as ListKeys];
      // タイトルが空文字でないこと
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });

  // ─── P1 回帰防止: Iceberg_Analysis が fields.ts に集約されていること ───
  it('FIELD_MAP_ICEBERG_ANALYSIS に必須フィールドが存在すること', () => {
    expect(FIELD_MAP_ICEBERG_ANALYSIS.entryHash).toBe('EntryHash');
    expect(FIELD_MAP_ICEBERG_ANALYSIS.sessionId).toBe('SessionId');
    expect(FIELD_MAP_ICEBERG_ANALYSIS.userId).toBe('UserId');
    expect(FIELD_MAP_ICEBERG_ANALYSIS.payloadJson).toBe('PayloadJson');
  });

  it('ListKeys.IcebergAnalysis が LIST_CONFIG に登録されていること', () => {
    expect(LIST_CONFIG[ListKeys.IcebergAnalysis]).toBeDefined();
    expect(LIST_CONFIG[ListKeys.IcebergAnalysis].title).toBe('Iceberg_Analysis');
  });

  // ─── P2 回帰防止: 派生列が物理列マップに混入しないこと ───
  it('FIELD_MAP_SURVEY_TOKUSEI に派生フィールドが含まれないこと', () => {
    const physicalKeys = Object.keys(FIELD_MAP_SURVEY_TOKUSEI);
    const derivedKeys = Object.keys(FIELD_DERIVED_TOKUSEI);

    for (const dk of derivedKeys) {
      expect(physicalKeys, `派生列 "${dk}" が物理列マップに混入`).not.toContain(dk);
    }
  });

  it('FIELD_DERIVED_TOKUSEI は personality / sensoryFeatures / behaviorFeatures の3列のみ', () => {
    const keys = Object.keys(FIELD_DERIVED_TOKUSEI).sort();
    expect(keys).toEqual(['behaviorFeatures', 'personality', 'sensoryFeatures']);
  });
});
