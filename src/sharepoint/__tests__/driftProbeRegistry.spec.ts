import { describe, expect, it } from 'vitest';
import {
  getDriftProbeTargets,
  getSupportCaseExperimentalDriftProbeTargets,
  SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG,
} from '../driftProbeRegistry';
import { SP_LIST_REGISTRY } from '../spListRegistry';

const supportCaseRegistryKeys = [
  'support_cases',
  'support_case_documents',
  'support_case_events',
  'support_case_restricted_documents',
] as const;

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
    const expectedTitle = SP_LIST_REGISTRY.find(e => e.key === 'users_master')?.resolve();
    expect(users?.listTitle).toBe(expectedTitle);
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

  it('keeps experimental SupportCase resources out of default drift probes', () => {
    const targetKeys = new Set(getDriftProbeTargets().map(target => target.key));

    for (const key of supportCaseRegistryKeys) {
      expect(targetKeys.has(key)).toBe(false);
    }
  });

  it('includes experimental SupportCase resources only through diagnostics opt-in', () => {
    expect(getSupportCaseExperimentalDriftProbeTargets()).toEqual([]);

    const targets = getSupportCaseExperimentalDriftProbeTargets({
      [SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG]: 'true',
    });

    expect(targets.map(target => target.key)).toEqual([...supportCaseRegistryKeys]);
    expect(targets.every(target => target.essentialFields?.includes('TenantId'))).toBe(true);
    expect(
      targets.find(target => target.key === 'support_case_restricted_documents')
        ?.baseTemplate,
    ).toBe(101);
  });

  it('excludes cross-site BillingOrders from default-site drift probes', () => {
    const activeRegistryCount = SP_LIST_REGISTRY.filter(
      e => e.lifecycle === 'required' || e.lifecycle === 'optional'
    ).length;

    const targets = getDriftProbeTargets({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/2',
    });

    expect(targets.some(t => t.key === 'billing_orders')).toBe(false);
    expect(targets.length).toBe(activeRegistryCount - 1);
  });

  it('keeps BillingOrders in drift probes when it uses the default site', () => {
    const targets = getDriftProbeTargets({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/welfare/',
    });

    expect(targets.some(t => t.key === 'billing_orders')).toBe(true);
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

  it('registers BillingOrders fields used by coffee order billing and settlement', () => {
    const entry = SP_LIST_REGISTRY.find(e => e.key === 'billing_orders');
    const fields = entry?.provisioningFields ?? [];
    const fieldMap = new Map(fields.map(field => [field.internalName, field]));

    expect(entry).toBeDefined();
    expect(Array.from(fieldMap.keys())).toEqual(expect.arrayContaining([
      'Title',
      'OrdererCode',
      'OrdererName',
      'OrderCount',
      'Item',
      'Served',
      'Sugar',
      'Milk',
      'DrinkPrice',
      'PaymentStatus',
      'PaidAt',
      'PaidBy',
    ]));
    expect(fieldMap.get('PaymentStatus')).toMatchObject({
      type: 'Choice',
      choices: ['未精算', '精算済み'],
      default: '未精算',
    });
    expect(fieldMap.get('PaidAt')).toMatchObject({
      type: 'DateTime',
      dateTimeFormat: 'DateTime',
    });
    expect(fieldMap.get('PaidBy')).toMatchObject({ type: 'Text' });
    expect(fieldMap.get('DrinkPrice')).toMatchObject({
      type: 'Number',
      candidates: ['DrinkPrice', 'DRINK_PRICE'],
    });
  });

  it('correctly registers ToiletRecords in drift probe registry', () => {
    const targets = getDriftProbeTargets();
    const toilet = targets.find(t => t.key === 'toilet_records');

    expect(toilet).toBeDefined();
    expect(toilet?.selectFields).toContain('Id');
    expect(toilet?.selectFields).toContain('Title');
    expect(toilet?.selectFields).toContain('UserId');
    expect(toilet?.selectFields).toContain('RecordDate');
    expect(toilet?.selectFields).toContain('ToiletType');
    expect(toilet?.selectFields).toContain('IsDeleted');
  });
});
