import { vi } from 'vitest';

/**
 * Suppresses console.warn or console.error during the execution of a function (sync or async)
 * and verifies that the expected message pattern was matched if provided.
 * Restores the console function using try/finally.
 */
export async function suppressConsoleDuring(
  type: 'error' | 'warn',
  fn: () => void | Promise<void>,
  expectedMessage?: string | RegExp,
): Promise<void> {
  const spy = vi.spyOn(console, type).mockImplementation(() => {});
  try {
    await fn();
    if (expectedMessage) {
      const calls = spy.mock.calls
        .map((args) =>
          args
            .map((arg) => {
              if (arg instanceof Error) return arg.message;
              if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
              return String(arg);
            })
            .join(' '),
        )
        .join('\n');

      const matched =
        typeof expectedMessage === 'string'
          ? calls.includes(expectedMessage)
          : expectedMessage.test(calls);

      if (!matched) {
        throw new Error(
          `Expected console.${type} call matching: ${expectedMessage}\nActual calls:\n${calls || '(none)'}`,
        );
      }
    }
  } finally {
    spy.mockRestore();
  }
}

/**
 * Suppresses "not wrapped in act" warnings in console.error during tests.
 * Returns a restore function that should be called in afterEach or afterAll.
 */
export function suppressActWarnings(): () => void {
  const originalConsoleError = console.error;
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : String(args[0] || '');
    if (msg.includes('not wrapped in act')) return;
    originalConsoleError(...args);
  });
  return () => {
    spy.mockRestore();
  };
}

