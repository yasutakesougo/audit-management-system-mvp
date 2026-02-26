export const shouldTriggerNavShellHud = (event: KeyboardEvent): boolean => {
  // Ignore repeated key events
  if (event.repeat) return false;

  // Must be Alt+P (case insensitive)
  if (!event.altKey || event.key.toLowerCase() !== 'p') return false;

  // Must not have other modifier keys
  if (event.ctrlKey || event.shiftKey || event.metaKey) return false;

  // Check if focused element is editable
  const target = event.target as Element;
  if (target) {
    const tagName = target.tagName?.toLowerCase();

    // Input and textarea elements
    if (tagName === 'input' || tagName === 'textarea') return false;

    // Contenteditable elements
    if (target instanceof HTMLElement && target.isContentEditable) return false;
  }

  return true;
};
