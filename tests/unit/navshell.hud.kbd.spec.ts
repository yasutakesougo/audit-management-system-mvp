import { shouldTriggerNavShellHud } from '@/app/AppShell';
import { describe, expect, it } from 'vitest';

describe('shouldTriggerNavShellHud', () => {
  const createEvent = (options: KeyboardEventInit, target?: HTMLElement) => {
    const event = new KeyboardEvent('keydown', options);
    if (target) {
      Object.defineProperty(event, 'target', {
        value: target,
        configurable: true,
      });
    }
    return event;
  };

  it('returns true only for Alt+P without other modifiers', () => {
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, key: 'p' }))).toBe(true);
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, key: 'P' }))).toBe(true);
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, shiftKey: true, key: 'p' }))).toBe(false);
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, ctrlKey: true, key: 'p' }))).toBe(false);
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, metaKey: true, key: 'p' }))).toBe(false);
    expect(shouldTriggerNavShellHud(createEvent({ altKey: true, key: 'q' }))).toBe(false);
  });

  it('returns false when editable targets are focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const editableEvent = createEvent({ altKey: true, key: 'p' }, input);
    expect(shouldTriggerNavShellHud(editableEvent)).toBe(false);

    const textarea = document.createElement('textarea');
    const textareaEvent = createEvent({ altKey: true, key: 'p' }, textarea);
    expect(shouldTriggerNavShellHud(textareaEvent)).toBe(false);

    const contentEditable = document.createElement('div');
    contentEditable.contentEditable = 'true';
    // In test environment, we need to manually set isContentEditable
    Object.defineProperty(contentEditable, 'isContentEditable', {
      value: true,
      configurable: true,
    });
    const editableDivEvent = createEvent({ altKey: true, key: 'p' }, contentEditable);
    expect(shouldTriggerNavShellHud(editableDivEvent)).toBe(false);
  });
});
