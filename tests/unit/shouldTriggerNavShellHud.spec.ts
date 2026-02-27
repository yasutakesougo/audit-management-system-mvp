import { shouldTriggerNavShellHud } from '@/app/hudHelpers';
import { describe, expect, it } from 'vitest';

const createEvent = (init: Partial<KeyboardEvent> = {}, target?: HTMLElement) => {
  const event = new KeyboardEvent('keydown', { altKey: true, key: 'p', ...init });
  if (target) {
    Object.defineProperty(event, 'target', {
      value: target,
      configurable: true
    });
  }
  return event;
};

describe('shouldTriggerNavShellHud', () => {
  it('fires on Alt+P without editable focus', () => {
    expect(shouldTriggerNavShellHud(createEvent())).toBe(true);
  });

  it('ignores repeated key events', () => {
    const event = createEvent();
    Object.defineProperty(event, 'repeat', { value: true });
    expect(shouldTriggerNavShellHud(event)).toBe(false);
  });

  it('ignores when focused element is editable', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(shouldTriggerNavShellHud(createEvent({}, input))).toBe(false);
    input.remove();
  });

  it('ignores when non-matching modifier keys are pressed', () => {
    expect(shouldTriggerNavShellHud(createEvent({ ctrlKey: true }))).toBe(false);
    expect(shouldTriggerNavShellHud(createEvent({ shiftKey: true }))).toBe(false);
    expect(shouldTriggerNavShellHud(createEvent({ metaKey: true }))).toBe(false);
  });

  it('ignores when key is not P', () => {
    expect(shouldTriggerNavShellHud(new KeyboardEvent('keydown', { altKey: true, key: 'x' }))).toBe(false);
  });
});
