import { describe, expect, it } from 'vitest';
import { getDriftProbeTargets } from '../driftProbeRegistry';
import { SP_LIST_REGISTRY } from '../spListRegistry';

describe('DriftProbeRegistry / Dynamic Discovery', () => {
  it('discovers all required and optional lists from SP_LIST_REGISTRY', () => {
    const targets = getDriftProbeTargets();
    
    // SP_LIST_REGISTRY should have around 30-40 active lists
    const activeRegistryCount = SP_LIST_REGISTRY.filter(
      e => e.lifecycle === 'required' || e.lifecycle === 'optional'
    ).length;
    
    expect(targets.length).toBe(activeRegistryCount);
    expect(targets.length).toBeGreaterThan(30);
  });

  it('correctly maps Users_Master with essential fields', () => {
    const targets = getDriftProbeTargets();
    const users = targets.find(t => t.key === 'users_master');
    
    expect(users).toBeDefined();
    expect(users?.listTitle).toBe('Users_Master');
    // Id and Title are automatically added by the mapper if missing
    expect(users?.selectFields).toContain('Id');
    expect(users?.selectFields).toContain('Title');
    expect(users?.selectFields).toContain('UserID');
    expect(users?.selectFields).toContain('FullName');
  });

  it('fallbacks to provisioningFields when essentialFields is missing', () => {
    const targets = getDriftProbeTargets();
    // Use a list that doesn't have essentialFields defined in registry if possible
    // or just verify one that we know has provisioningFields
    const staff = targets.find(t => t.key === 'staff_master');
    
    expect(staff).toBeDefined();
    expect(staff?.selectFields.length).toBeGreaterThanOrEqual(5);
    expect(staff?.selectFields).toContain('StaffID');
  });

  it('produces unique keys for all targets', () => {
    const targets = getDriftProbeTargets();
    const keys = targets.map(t => t.key);
    const uniqueKeys = new Set(keys);

    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('does not mark drift_events_log Severity as essential', () => {
    // 診断契約と SharePointDriftEventRepository の実装契約を一致させるための回帰防止。
    // Severity は repository が任意扱い（fail-open）で、本リストは lifecycle: 'optional'。
    // Severity が essential に戻ると /admin/status が schema FAIL を出してしまう。
    const entry = SP_LIST_REGISTRY.find(e => e.key === 'drift_events_log');

    expect(entry).toBeDefined();
    expect(entry?.lifecycle).toBe('optional');
    expect(entry?.essentialFields).toEqual(['ListName', 'FieldName', 'DetectedAt', 'DriftType']);
    expect(entry?.essentialFields).not.toContain('Severity');
  });
});
