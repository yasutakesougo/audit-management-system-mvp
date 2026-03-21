import { describe, expect, it } from 'vitest';
import {
  buildSuggestionLifecycleWindow,
  formatSuggestionRate,
} from '../suggestionLifecycle';

describe('buildSuggestionLifecycleWindow', () => {
  const now = new Date('2026-03-21T12:34:56.000Z');

  it('today は当日0時〜now かつ maxDocs=200', () => {
    const window = buildSuggestionLifecycleWindow('today', now);

    expect(window.days).toBe(1);
    expect(window.maxDocs).toBe(200);
    expect(window.from.getFullYear()).toBe(now.getFullYear());
    expect(window.from.getMonth()).toBe(now.getMonth());
    expect(window.from.getDate()).toBe(now.getDate());
    expect(window.from.getHours()).toBe(0);
    expect(window.from.getMinutes()).toBe(0);
    expect(window.from.getSeconds()).toBe(0);
    expect(window.from.getMilliseconds()).toBe(0);
    expect(window.to.toISOString()).toBe('2026-03-21T12:34:56.000Z');
  });

  it('7d は now から7日遡る', () => {
    const window = buildSuggestionLifecycleWindow('7d', now);

    expect(window.days).toBe(7);
    expect(window.maxDocs).toBe(500);
    expect(window.from.toISOString()).toBe('2026-03-14T12:34:56.000Z');
    expect(window.to.toISOString()).toBe('2026-03-21T12:34:56.000Z');
  });

  it('30d は now から30日遡る', () => {
    const window = buildSuggestionLifecycleWindow('30d', now);

    expect(window.days).toBe(30);
    expect(window.maxDocs).toBe(2000);
    expect(window.from.toISOString()).toBe('2026-02-19T12:34:56.000Z');
    expect(window.to.toISOString()).toBe('2026-03-21T12:34:56.000Z');
  });
});

describe('formatSuggestionRate', () => {
  it('小数1桁でパーセント表示する', () => {
    expect(formatSuggestionRate(0)).toBe('0.0%');
    expect(formatSuggestionRate(0.1234)).toBe('12.3%');
    expect(formatSuggestionRate(1)).toBe('100.0%');
  });

  it('NaN / 負値は 0% 扱いにする', () => {
    expect(formatSuggestionRate(Number.NaN)).toBe('0.0%');
    expect(formatSuggestionRate(-1)).toBe('0.0%');
  });
});
