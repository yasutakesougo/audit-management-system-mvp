import { EXECUTION_RECORD_KEY } from '@/features/daily/domain/executionRecordTypes';
import { __resetStore } from '@/features/daily/stores/executionStore';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// We need to import ExecutionToggle after store setup
import { ExecutionToggle } from '../ExecutionToggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_DATE = '2025-04-01';
const TEST_USER = 'U-001';
const TEST_SLOT = 'slot-0900-朝の会';

function renderToggle(overrides: { scheduleItemId?: string } = {}) {
  return render(
    <ExecutionToggle
      date={TEST_DATE}
      userId={TEST_USER}
      scheduleItemId={overrides.scheduleItemId ?? TEST_SLOT}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionToggle', () => {
  beforeEach(() => {
    localStorage.removeItem(EXECUTION_RECORD_KEY);
    __resetStore();
  });

  afterEach(() => {
    localStorage.removeItem(EXECUTION_RECORD_KEY);
    __resetStore();
  });

  it('renders 3 toggle buttons: 完了 / 発動 / スキップ', () => {
    renderToggle();

    expect(screen.getByText('完了')).toBeTruthy();
    expect(screen.getByText('発動')).toBeTruthy();
    expect(screen.getByText('スキップ')).toBeTruthy();
  });

  it('selects completed status when clicking 完了', () => {
    renderToggle();

    const btn = screen.getByTestId(`exec-btn-completed-${TEST_SLOT}`);
    fireEvent.click(btn);

    // After clicking, the button should be selected (aria-pressed)
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('selects triggered status and shows memo field', () => {
    renderToggle();

    const btn = screen.getByTestId(`exec-btn-triggered-${TEST_SLOT}`);
    fireEvent.click(btn);

    expect(btn.getAttribute('aria-pressed')).toBe('true');

    // Memo field should appear
    const memo = screen.getByTestId(`exec-memo-${TEST_SLOT}`);
    expect(memo).toBeTruthy();
  });

  it('does NOT show memo field for completed status', () => {
    renderToggle();

    fireEvent.click(screen.getByTestId(`exec-btn-completed-${TEST_SLOT}`));

    expect(screen.queryByTestId(`exec-memo-${TEST_SLOT}`)).toBeNull();
  });

  it('does NOT show memo field for skipped status', () => {
    renderToggle();

    fireEvent.click(screen.getByTestId(`exec-btn-skipped-${TEST_SLOT}`));

    expect(screen.queryByTestId(`exec-memo-${TEST_SLOT}`)).toBeNull();
  });

  it('persists memo text in triggered state', () => {
    renderToggle();

    // Set to triggered
    fireEvent.click(screen.getByTestId(`exec-btn-triggered-${TEST_SLOT}`));

    // Type into memo
    const input = screen.getByPlaceholderText('発動メモ（例: イヤーマフで落ち着いた）');
    fireEvent.change(input, { target: { value: 'パニック発生' } });

    expect(input).toHaveValue('パニック発生');
  });

  it('has correct displayName', () => {
    expect(ExecutionToggle.displayName).toBe('ExecutionToggle');
  });
});
