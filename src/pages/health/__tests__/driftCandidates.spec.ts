import { describe, expect, it } from 'vitest';
import { buildListSpecs } from '../driftCandidates';

describe('health driftCandidates', () => {
  it('excludes cross-site BillingOrders from default-site health drift checks', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/2',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(false);
  });

  it('keeps BillingOrders when no cross-site override is configured', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(true);
  });

  it('keeps BillingOrders when the override points to the default site', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/welfare/',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(true);
  });

  it('correctly populates drift candidates for Users_Master and ToiletRecords fields', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
    });

    // 1. Users_Master RequiresToiletGuidance verification
    const usersSpec = specs.find(s => s.key === 'users_master');
    expect(usersSpec).toBeDefined();
    const reqToiletField = usersSpec?.requiredFields.find(f => f.internalName === 'RequiresToiletGuidance');
    expect(reqToiletField).toBeDefined();
    expect(reqToiletField?.candidates).toContain('Requires_x0020_Toilet_x0020_Guid');

    // 2. ToiletRecords field candidates verification
    const toiletSpec = specs.find(s => s.key === 'toilet_records');
    expect(toiletSpec).toBeDefined();

    const userIdField = toiletSpec?.requiredFields.find(f => f.internalName === 'UserId');
    expect(userIdField?.candidates).toContain('User_x0020_ID');

    const recordDateField = toiletSpec?.requiredFields.find(f => f.internalName === 'RecordDate');
    expect(recordDateField?.candidates).toContain('Record_x0020_Date');

    const occurredAtField = toiletSpec?.requiredFields.find(f => f.internalName === 'OccurredAt');
    expect(occurredAtField?.candidates).toContain('Occurred_x0020_At');

    const toiletTypeField = toiletSpec?.requiredFields.find(f => f.internalName === 'ToiletType');
    expect(toiletTypeField?.candidates).toContain('Toilet_x0020_Type');

    const recorderNameField = toiletSpec?.requiredFields.find(f => f.internalName === 'RecorderName');
    expect(recorderNameField?.candidates).toContain('Recorder_x0020_Name');

    const isDeletedField = toiletSpec?.requiredFields.find(f => f.internalName === 'IsDeleted');
    expect(isDeletedField?.candidates).toContain('Is_x0020_Deleted');
  });
});
