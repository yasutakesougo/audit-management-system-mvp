/**
 * Contract Tests — Design Contract Enforcement
 *
 * PURPOSE: Prevent regression of the 3-module unified design contract.
 * These tests run on every CI build.
 *
 * 3 Guards:
 * 1. SP Direct Access Prevention — no spClient/@pnp/sp import outside infra/
 * 2. Domain SSOT Violation — no export interface in domain/ outside schema.ts
 * 3. File Size Signal — Orchestrator/Form files must stay ≤600 lines
 *
 * Hardened Modules (expand as modules are hardened):
 * - users, schedules, daily
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Config ───────────────────────────────────────────────────────────────

const HARDENED_MODULES = ['users', 'schedules', 'daily', 'attendance'] as const;
const FEATURES_DIR = join(__dirname, '..', '..', '..', 'src', 'features');
const MAX_ORCHESTRATOR_LINES = 600;

const SP_DIRECT_PATTERNS = [
  /from\s+['"]@\/lib\/spClient['"]/,
  /from\s+['"]@pnp\/sp/,
  /require\s*\(\s*['"]@\/lib\/spClient['"]\s*\)/,
  /require\s*\(\s*['"]@pnp\/sp/,
];

const INTERFACE_DEFINITION_PATTERN = /^export\s+(interface|type\s+\w+\s*=\s*\{)/;
const SSOT_ALLOWED_FILES = ['schema.ts'];
const ALLOW_INTERFACE_ANNOTATION = '// contract:allow-interface';
const ALLOW_LARGE_FILE_ANNOTATION = '// contract:allow-large-file';
const ALLOW_SP_DIRECT_ANNOTATION = '// contract:allow-sp-direct';
const SIZE_GUARD_PATTERNS = [/orchestrator/i, /Form\.tsx$/];

// ─── Helpers ──────────────────────────────────────────────────────────────

function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          // skip
        } else {
          results.push(...walkDir(fullPath, ext));
        }
      } else if (ext.some((e) => entry.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

function isInInfra(filePath: string): boolean {
  const rel = relative(FEATURES_DIR, filePath).split(sep);
  return rel.includes('infra');
}

function isInDataLayer(filePath: string): boolean {
  const rel = relative(FEATURES_DIR, filePath).split(sep);
  return rel.includes('data');
}

function getBaseName(filePath: string): string {
  return filePath.split(sep).pop() ?? '';
}

// ─── Guard 1: SP Direct Access Prevention ─────────────────────────────────

describe('Contract: SP Direct Access Prevention', () => {
  for (const mod of HARDENED_MODULES) {
    it(`${mod}/ — no spClient or @pnp/sp import outside infra/`, () => {
      const moduleDir = join(FEATURES_DIR, mod);
      const files = walkDir(moduleDir, ['.ts', '.tsx']);
      const violations: string[] = [];

      for (const file of files) {
        if (isInInfra(file) || isInDataLayer(file)) {
          // infra/ = allowed SP layer, data/ = legacy adapter (scheduled for removal)
        } else {
          const content = readFileSync(file, 'utf-8');
          if (content.includes(ALLOW_SP_DIRECT_ANNOTATION)) {
            // Explicitly opted out
          } else {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.includes('import type')) {
                // type-only imports don't create runtime coupling — allowed
              } else {
                for (const pattern of SP_DIRECT_PATTERNS) {
                  if (pattern.test(line)) {
                    violations.push(`${relative(FEATURES_DIR, file)}:${i + 1} → ${line.trim()}`);
                  }
                }
              }
            }
          }
        }
      }

      expect(
        violations,
        `SP direct access found outside infra/ in ${mod}/:\n${violations.join('\n')}`,
      ).toEqual([]);
    });
  }
});

// ─── Guard 2: Domain SSOT Violation Detection ─────────────────────────────

describe('Contract: Domain SSOT — schema.ts is the only type source', () => {
  for (const mod of HARDENED_MODULES) {
    it(`${mod}/domain/ — no export interface outside schema.ts`, () => {
      const domainDir = join(FEATURES_DIR, mod, 'domain');
      const files = walkDir(domainDir, ['.ts']);
      const violations: string[] = [];

      for (const file of files) {
        const base = getBaseName(file);
        if (SSOT_ALLOWED_FILES.includes(base) || base.endsWith('.d.ts')) {
          // Allowed files — skip
        } else {
          const content = readFileSync(file, 'utf-8');
          if (content.includes(ALLOW_INTERFACE_ANNOTATION)) {
            // Explicitly opted out — skip
          } else {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (INTERFACE_DEFINITION_PATTERN.test(lines[i].trim())) {
                violations.push(`${relative(FEATURES_DIR, file)}:${i + 1} → ${lines[i].trim()}`);
              }
            }
          }
        }
      }

      expect(
        violations,
        `Interface/type definitions found outside schema.ts in ${mod}/domain/.\n` +
          `Move to schema.ts and use z.infer, or add "${ALLOW_INTERFACE_ANNOTATION}":\n` +
          violations.join('\n'),
      ).toEqual([]);
    });
  }
});

// ─── Guard 3: File Size Signal ────────────────────────────────────────────

describe('Contract: Orchestrator/Form file size ≤ 600 lines', () => {
  for (const mod of HARDENED_MODULES) {
    const moduleDir = join(FEATURES_DIR, mod);
    const allFiles = walkDir(moduleDir, ['.ts', '.tsx']);
    const targetFiles = allFiles.filter((f) => {
      const base = getBaseName(f);
      return SIZE_GUARD_PATTERNS.some((p) => p.test(base));
    });

    for (const file of targetFiles) {
      const rel = relative(FEATURES_DIR, file);

      it(`${rel} ≤ ${MAX_ORCHESTRATOR_LINES} lines`, () => {
        const content = readFileSync(file, 'utf-8');
        if (content.includes(ALLOW_LARGE_FILE_ANNOTATION)) {
          return; // Explicitly opted out
        }
        const lineCount = content.split('\n').length;
        expect(
          lineCount,
          `${rel} has ${lineCount} lines (limit: ${MAX_ORCHESTRATOR_LINES}).\n` +
            `Decompose into sub-hooks/components, or add "${ALLOW_LARGE_FILE_ANNOTATION}".`,
        ).toBeLessThanOrEqual(MAX_ORCHESTRATOR_LINES);
      });
    }
  }
});
