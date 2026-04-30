// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildResult } from '../check-act-warnings.mjs';

describe('check-act-warnings buildResult', () => {
  it('counts warnings using a plain vitest stderr header', () => {
    const log = [
      'stderr | tests/unit/demoGuard.spec.ts > Demo Mode Guards > case',
      'Warning: An update to TestComponent inside a test was not wrapped in act(...).',
    ].join('\n');

    const result = buildResult(log);
    expect(result.totalWarnings).toBe(1);
    expect(result.affectedFiles).toBe(1);
    expect(result.countsByFile['tests/unit/demoGuard.spec.ts']).toBe(1);
  });

  it('parses GitHub Actions prefixed logs with ANSI color escapes', () => {
    const log = [
      'quality\tUNKNOWN STEP\t2026-04-30T02:40:20.3918195Z \u001b[90mstderr\u001b[2m | src/pages/__tests__/DailyRecordMenuPage.test.tsx > DailyRecordMenuPage > case',
      'quality\tUNKNOWN STEP\t2026-04-30T02:40:20.3920451Z \u001b[22m\u001b[39mWarning: An update to ForwardRef(ButtonBase) inside a test was not wrapped in act(...).',
    ].join('\n');

    const result = buildResult(log);
    expect(result.totalWarnings).toBe(1);
    expect(result.affectedFiles).toBe(1);
    expect(result.countsByFile['src/pages/__tests__/DailyRecordMenuPage.test.tsx']).toBe(1);
    expect(result.maxWarningsFile).toBe('src/pages/__tests__/DailyRecordMenuPage.test.tsx');
  });

  it('keeps the latest stderr header as the warning source file', () => {
    const log = [
      'stderr | tests/unit/demoGuard.spec.ts > suite > case',
      'Warning: An update to TestComponent inside a test was not wrapped in act(...).',
      'stderr | src/pages/__tests__/DailyRecordMenuPage.test.tsx > suite > case',
      'Warning: An update to ForwardRef(ButtonBase) inside a test was not wrapped in act(...).',
    ].join('\n');

    const result = buildResult(log);
    expect(result.totalWarnings).toBe(2);
    expect(result.countsByFile['tests/unit/demoGuard.spec.ts']).toBe(1);
    expect(result.countsByFile['src/pages/__tests__/DailyRecordMenuPage.test.tsx']).toBe(1);
  });
});
