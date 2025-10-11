import type { ConsoleMessage, Page } from '@playwright/test';

type ConsoleRecord = {
  type: string;
  text: string;
  location?: string;
};

type HookConsoleOptions = {
  ignore?: (message: ConsoleMessage) => boolean;
};

export type ConsoleGuard = {
  dispose: () => void;
  assertClean: () => Promise<void>;
};

const LOUD_TYPES = new Set(['error', 'warning']);

export function hookConsole(page: Page, options: HookConsoleOptions = {}): ConsoleGuard {
  const records: ConsoleRecord[] = [];

  const handler = (message: ConsoleMessage) => {
    if (!LOUD_TYPES.has(message.type())) return;
    if (options.ignore?.(message)) return;
    const location = message.location();
    const locationText = location?.url
      ? `${location.url}${typeof location.lineNumber === 'number' ? `:${location.lineNumber}` : ''}`
      : undefined;
    records.push({
      type: message.type(),
      text: message.text(),
      location: locationText,
    });
  };

  page.on('console', handler);

  const dispose = () => {
    page.off('console', handler);
  };

  const assertClean = async () => {
    try {
      if (records.length === 0) return;
      const details = records
        .map((record, index) => {
          const header = `${index + 1}. [${record.type.toUpperCase()}]`;
          const location = record.location ? `\n   at ${record.location}` : '';
          return `${header} ${record.text}${location}`;
        })
        .join('\n');
      throw new Error(`Unexpected console output detected:\n${details}`);
    } finally {
      dispose();
    }
  };

  return { dispose, assertClean };
}
