import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTransportVehicleNameOverride,
  getDefaultTransportVehicleName,
  loadTransportVehicleNameOverrides,
  resolveTransportVehicleName,
  saveTransportVehicleNameOverrides,
} from './transportVehicleNames';

describe('transportVehicleNames', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves default display names for fixed vehicles', () => {
    expect(getDefaultTransportVehicleName('車両1')).toBe('ブルー');
    expect(getDefaultTransportVehicleName('車両2')).toBe('シルバー');
    expect(resolveTransportVehicleName('車両3')).toBe('ハイエース');
    expect(resolveTransportVehicleName('車両4')).toBe('スクラム');
  });

  it('uses custom override when provided', () => {
    const next = applyTransportVehicleNameOverride({}, '車両1', '青1号');
    expect(resolveTransportVehicleName('車両1', next)).toBe('青1号');
  });

  it('removes override when value is empty or default name', () => {
    const withOverride = applyTransportVehicleNameOverride({}, '車両2', '銀バス');
    expect(resolveTransportVehicleName('車両2', withOverride)).toBe('銀バス');

    const removedByEmpty = applyTransportVehicleNameOverride(withOverride, '車両2', '');
    expect(resolveTransportVehicleName('車両2', removedByEmpty)).toBe('シルバー');

    const addedAgain = applyTransportVehicleNameOverride({}, '車両2', '銀バス');
    const removedByDefault = applyTransportVehicleNameOverride(addedAgain, '車両2', 'シルバー');
    expect(resolveTransportVehicleName('車両2', removedByDefault)).toBe('シルバー');
  });

  it('saves and loads overrides from localStorage', () => {
    const overrides = applyTransportVehicleNameOverride({}, '車両4', 'スクラム号');
    saveTransportVehicleNameOverrides(overrides);

    expect(loadTransportVehicleNameOverrides()).toEqual({ 車両4: 'スクラム号' });
    expect(resolveTransportVehicleName('車両4', loadTransportVehicleNameOverrides())).toBe('スクラム号');
  });

  it('returns empty overrides when persisted data is invalid', () => {
    localStorage.setItem('transport.vehicle-name-overrides.v1', '{invalid');
    expect(loadTransportVehicleNameOverrides()).toEqual({});
  });
});

