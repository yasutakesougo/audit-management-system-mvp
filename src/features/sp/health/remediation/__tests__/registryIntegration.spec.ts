import { describe, it, expect } from 'vitest';
import { findListEntry } from '@/sharepoint/spListRegistry';

/**
 * remediation_audit_log の SP List Registry 統合テスト
 *
 * Coordinator が bootstrap 時にこのエントリを正しく処理できることを検証する。
 * - findListEntry で発見可能
 * - resolve() が有効なリスト名を返す
 * - lifecycle: optional（bootstrap 失敗で業務停止しない）
 * - provisioningFields が定義されている（自動作成可能）
 * - essentialFields が provisioningFields のサブセット
 */
describe('remediation_audit_log registry entry', () => {
  const entry = findListEntry('remediation_audit_log');

  it('should be discoverable via findListEntry', () => {
    expect(entry).toBeDefined();
  });

  it('should resolve to a valid list title', () => {
    expect(entry!.resolve()).toBe('Remediation_AuditLog');
  });

  it('should be lifecycle: optional', () => {
    expect(entry!.lifecycle).toBe('optional');
  });

  it('should be category: compliance', () => {
    expect(entry!.category).toBe('compliance');
  });

  it('should have R/W operations', () => {
    expect(entry!.operations).toContain('R');
    expect(entry!.operations).toContain('W');
  });

  it('should have provisioningFields defined for auto-creation', () => {
    expect(entry!.provisioningFields).toBeDefined();
    expect(entry!.provisioningFields!.length).toBeGreaterThan(0);
  });

  it('should have essentialFields that are a subset of provisioningFields', () => {
    const provFieldNames = new Set(
      entry!.provisioningFields!.map((f: { internalName: string }) => f.internalName),
    );
    for (const essential of entry!.essentialFields ?? []) {
      expect(provFieldNames.has(essential)).toBe(true);
    }
  });

  it('should include required audit fields in provisioningFields', () => {
    const fieldNames = entry!.provisioningFields!.map(
      (f: { internalName: string }) => f.internalName,
    );
    // 監査に最低限必要な5フィールド
    expect(fieldNames).toContain('PlanId');
    expect(fieldNames).toContain('Phase');
    expect(fieldNames).toContain('ListKey');
    expect(fieldNames).toContain('Action');
    expect(fieldNames).toContain('Timestamp');
  });

  it('should have PlanId and ListKey as indexed for query performance', () => {
    const indexed = entry!.provisioningFields!
      .filter((f: { indexed?: boolean }) => f.indexed)
      .map((f: { internalName: string }) => f.internalName);
    expect(indexed).toContain('PlanId');
    expect(indexed).toContain('ListKey');
  });
});
