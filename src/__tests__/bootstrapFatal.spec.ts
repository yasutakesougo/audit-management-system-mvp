import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRequiredError } from '@/lib/errors';
import { installFatalHandlers } from '../bootstrapFatal';

const dispatchUnhandledRejection = (reason: unknown) => {
  const event = new Event('unhandledrejection', { cancelable: true }) as Event & {
    reason: unknown;
  };
  event.reason = reason;
  window.dispatchEvent(event);
  return event;
};

describe('bootstrapFatal', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.__APP_RENDERED__ = undefined;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.__APP_RENDERED__ = undefined;
    vi.restoreAllMocks();
  });

  it('renders bootstrap fatal panel before React has rendered', () => {
    installFatalHandlers();

    dispatchUnhandledRejection(new Error('chunk failed'));

    expect(document.getElementById('root')?.textContent).toContain('起動エラー (Async Promise)');
    expect(document.getElementById('root')?.textContent).toContain('chunk failed');
  });

  it('does not replace the app with a fatal panel after React has rendered', () => {
    installFatalHandlers();
    const root = document.getElementById('root');
    if (root) root.textContent = 'app content';
    window.__APP_RENDERED__ = true;

    dispatchUnhandledRejection(new Error('runtime data load failed'));

    expect(document.getElementById('root')?.textContent).toBe('app content');
  });

  it('does not show a bootstrap fatal panel for auth-required rejections', () => {
    installFatalHandlers();

    const event = dispatchUnhandledRejection(new AuthRequiredError());

    expect(event.defaultPrevented).toBe(true);
    expect(document.getElementById('root')?.textContent).toBe('');
  });
});
