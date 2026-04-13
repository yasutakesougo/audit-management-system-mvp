import { describe, it, expect } from 'vitest';
import { getHiddenOrdersBySelection, isStepHidden } from './procedureLogic';

describe('procedureLogic branching visibility', () => {
  it('should hide normal items 11 and 12 when row 18 (PM External Prep) is selected', () => {
    const selected = new Set([18]);
    const hidden = getHiddenOrdersBySelection(selected);
    expect(hidden).toContain(11);
    expect(hidden).toContain(12);
    expect(isStepHidden(11, selected)).toBe(true);
    expect(isStepHidden(12, selected)).toBe(true);
  });

  it('should hide normal items 11 and 12 when row 19 (PM External Entry) is selected', () => {
    const selected = new Set([19]);
    const hidden = getHiddenOrdersBySelection(selected);
    expect(hidden).toContain(11);
    expect(hidden).toContain(12);
  });

  it('should not hide anything when row 17 (AM External) is selected', () => {
    const selected = new Set([17]);
    const hidden = getHiddenOrdersBySelection(selected);
    expect(hidden).not.toContain(11);
    expect(hidden).not.toContain(12);
    expect(isStepHidden(11, selected)).toBe(false);
  });

  it('should not hide anything when an empty set is provided', () => {
    const selected = new Set<number>();
    const hidden = getHiddenOrdersBySelection(selected);
    expect(hidden.length).toBe(0);
  });
});
