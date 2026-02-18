import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * WeekView Density Guardrails
 * 
 * WeekView uses inline style values (not tokens) for density configuration.
 * These tests prevent regressions where the carefully tuned spacing values
 * get accidentally reverted to wider defaults.
 * 
 * Protected values:
 * - Lane grid: minWidth (240/260), gridAutoColumns (minmax 240/260), gap (12)
 * - Lane section: padding (8), header marginBottom (8)
 * - Card content: className spacing (px-3 py-2, sm:px-4 sm:py-3)
 */

describe('WeekView density guardrails', () => {
  let src: string;

  beforeAll(() => {
    // Read WeekView.tsx from repo root (vitest cwd = repo root)
    const filePath = path.resolve(process.cwd(), 'src/features/schedules/routes/WeekView.tsx');
    src = fs.readFileSync(filePath, 'utf8');
  });

  describe('lane grid density', () => {
    it('maintains gridAutoColumns minmax values (240/260px)', () => {
      // Current: isMobile ? 'minmax(240px, 1fr)' : 'minmax(260px, 1fr)'
      expect(src).toMatch(/gridAutoColumns:\s*isMobile\s*\?\s*['"]minmax\(240px,\s*1fr\)['"]\s*:\s*['"]minmax\(260px,\s*1fr\)['"]/);
    });

    it('maintains grid gap of 12 in main item list', () => {
      // Current: gap: 12 (in the item list grid, NOT the compact header which uses gap: 16)
      // Match: the grid just before itemsInLane loop that uses gridAutoColumns with 240/260px
      expect(src).toMatch(/gridAutoColumns:\s*isMobile\s*\?\s*['"]minmax\(240px,\s*1fr\)['"]\s*:\s*['"]minmax\(260px,\s*1fr\)['"],\s*gap:\s*12/);
    });

    it('maintains minWidth (240/260px)', () => {
      // Current: minWidth: isMobile ? 240 : 260
      expect(src).toMatch(/minWidth:\s*isMobile\s*\?\s*240\s*:\s*260/);
    });

    it('rejects regression to wider lanes (280px)', () => {
      // Must NOT have: minmax(280px, 1fr) or minWidth: 280
      expect(src).not.toMatch(/minmax\(280px/);
      expect(src).not.toMatch(/minWidth:\s*(?:isMobile\s*\?\s*)?280/);
    });
  });

  describe('lane section spacing', () => {
    it('maintains padding of 8', () => {
      // Current: style={{ padding: 8, ... }}
      expect(src).toMatch(/padding:\s*8\b/);
    });

    it('maintains header marginBottom of 8', () => {
      // Current: style={{ marginBottom: 8, ... }}
      expect(src).toMatch(/marginBottom:\s*8\b/);
    });

    it('rejects regression to padding 12', () => {
      // Must NOT have: padding: 12 in lane section
      expect(src).not.toMatch(/padding:\s*12\b/);
    });

    it('rejects regression to marginBottom 12', () => {
      // Must NOT have: marginBottom: 12 in header
      expect(src).not.toMatch(/marginBottom:\s*12\b/);
    });
  });

  describe('card content spacing className', () => {
    it('maintains compact mobile spacing (px-3 py-2)', () => {
      // Current: className="flex w-full flex-col gap-1.5 px-3 py-2 text-left sm:gap-2 sm:px-4 sm:py-3"
      expect(src).toContain('px-3 py-2');
    });

    it('maintains tablet/desktop spacing (sm:px-4 sm:py-3)', () => {
      // Current: sm:px-4 sm:py-3
      expect(src).toContain('sm:px-4 sm:py-3');
    });

    it('maintains gap-1.5 between card content elements', () => {
      // Current: gap-1.5 (includes gap-1 for meta/chip rows)
      expect(src).toContain('gap-1.5');
    });

    it('maintains sm:gap-2 for tablet spacing', () => {
      // Current: sm:gap-2
      expect(src).toContain('sm:gap-2');
    });

    it('rejects regression to wider card content (px-4 py-3)', () => {
      // Must NOT match: px-4 py-3 in main card content flex class
      // (Note: sm:px-4 is OK, but standalone px-4 py-3 outside responsive prefix is bad)
      const cardContentMatch = src.match(/className="flex w-full flex-col gap-[\d.]+\s+([^"]*?)"\s*onClick/);
      if (cardContentMatch) {
        const classes = cardContentMatch[1];
        expect(classes).not.toMatch(/^px-4 py-3/);
        expect(classes).not.toMatch(/\s+px-4 py-3(?:\s|")/);
      }
    });

    it('rejects regression to gap-2 on mobile', () => {
      // Must NOT have: gap-2 without sm: prefix in the main card content
      const cardContentMatch = src.match(/className="flex w-full flex-col (gap-[\d.]+)[^"]*" onClick/);
      if (cardContentMatch) {
        expect(cardContentMatch[1]).not.toEqual('gap-2');
      }
    });
  });

  describe('consistency across all density values', () => {
    it('all grid/spacing values align to compact density scheme', () => {
      // Smoke test: verify at least the key values are present
      const values = {
        'minmax(240px': src.includes('minmax(240px'),
        'minmax(260px': src.includes('minmax(260px'),
        'gap: 12': src.match(/gap:\s*12/) !== null,
        'padding: 8': src.match(/padding:\s*8/) !== null,
        'marginBottom: 8': src.match(/marginBottom:\s*8/) !== null,
        'px-3 py-2': src.includes('px-3 py-2'),
        'sm:px-4 sm:py-3': src.includes('sm:px-4 sm:py-3'),
      };

      const passCount = Object.values(values).filter(Boolean).length;
      expect(passCount).toBeGreaterThanOrEqual(6);
    });
  });
});
