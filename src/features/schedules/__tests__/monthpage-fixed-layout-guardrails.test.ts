import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * MonthPage Fixed Layout Guardrails
 *
 * MonthPage uses 100dvh fixed layout with ResizeObserver for iPad landscape support.
 * These tests prevent regressions where the fixed layout contract breaks,
 * causing cells to stretch or rows to get cut off.
 *
 * Protected contract:
 * - Section: height: 100dvh, overflow: hidden, boxSizing: border-box
 * - Padding: paddingBottom: 128px (footer/safe-area reserve)
 * - Observer: ResizeObserver observes pageRef (not flexing gridWrapRef)
 * - Measurement: headerH/weekdayH guard against 0-height initialization
 */

describe('MonthPage fixed layout guardrails', () => {
  let src: string;

  beforeAll(() => {
    const filePath = path.resolve(process.cwd(), 'src/features/schedules/routes/MonthPage.tsx');
    src = fs.readFileSync(filePath, 'utf8');
  });

  describe('fixed layout contract', () => {
    it('maintains height: 100dvh on section', () => {
      // Critical: section must be height 100dvh
      expect(src).toMatch(/height:\s*['"]100dvh['"]/);
    });

    it('maintains overflow: hidden on section', () => {
      // Critical: prevent scrolling
      expect(src).toMatch(/overflow:\s*['"]hidden['"]/);
    });

    it('maintains boxSizing: border-box on section', () => {
      // Critical: padding must be interior to 100dvh boundary
      expect(src).toMatch(/boxSizing:\s*['"]border-box['"]/);
    });

    it('maintains paddingBottom: 128px for footer reserve', () => {
      // Critical: footer/FAB safe-area accommodation
      expect(src).toMatch(/paddingBottom:\s*128/);
    });

    it('rejects regression to smaller padding (32px)', () => {
      // Must NOT reduce footer reserve to 32px (would hide 6th week)
      expect(src).not.toMatch(/paddingBottom:\s*32\b/);
    });
  });

  describe('ResizeObserver stability', () => {
    it('observes pageRef (fixed container), not gridWrapRef', () => {
      // Critical: observe FIXED page, not flex-resizing gridWrap
      expect(src).toContain('const page = pageRef.current');
      expect(src).toContain('ro.observe(page)');
      expect(src).not.toContain('ro.observe(wrap)'); // old pattern
    });

    it('guards against 0-height during initialization', () => {
      // Critical: prevent false measurements before layout is ready
      expect(src).toMatch(/if\s*\(\s*headerH\s*===\s*0\s*\|\|\s*weekdayH\s*===\s*0\s*\)/);
    });

    it('calls ro.disconnect() in cleanup', () => {
      // Critical: prevent observer leaks
      expect(src).toContain('ro.disconnect()');
    });

    it('notes design intent for future maintainers', () => {
      // Cultural: document why pageRef (prevents feedback loop regressions)
      expect(src).toContain('NOTE: Observe pageRef (fixed 100dvh) instead of gridWrapRef (flex) to avoid resize feedback loops');
    });
  });

  describe('fallback for initial measurement', () => {
    it('uses flex: 1 fallback when cellGridH not yet calculated', () => {
      // Safety: during observer init, rows flex-grow to fill space
      expect(src).toMatch(/cellGridH\s*\?\s*\{\s*height:\s*cellGridH\s*\}\s*:\s*\{\s*flex:\s*1\s*\}/);
    });
  });

  describe('iPad landscape regression prevention', () => {
    it('rejects regression to display: contents on week rows', () => {
      // display: contents would break height control
      expect(src).not.toMatch(/display:\s*['"]contents['"]\s*\};?\s*\}\s*\{weeks\.map/);
    });

    it('maintains pageRef as measurement root', () => {
      // Prevent accidental revert to old gridWrapRef pattern
      expect(src).toContain('const pageRef = useRef<HTMLDivElement>(null)');
      expect(src).toContain('ref={pageRef}');
    });

    it('maintains cellGridH state for height assignment', () => {
      // Prevent regression to cellMinH or other naming
      expect(src).toContain('const [cellGridH, setCellGridH] = useState<number | null>(null)');
    });
  });
});
