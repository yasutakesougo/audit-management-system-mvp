import { Page } from '@playwright/test';
import * as axe from 'axe-core';
import type { ElementContext, RunOnly, RunOptions } from 'axe-core';

type RunA11ySmokeOptions = {
  includeBestPractices?: boolean;
  selectors?: string | string[];
  runOptions?: RunOptions;
};

type AxeViolationSummary = {
  id: string;
  impact: string | null;
  helpUrl?: string;
  nodes: Array<{ html: string; target: string[] }>;
  description?: string;
};

type AxeRunResult = {
  violations: AxeViolationSummary[];
};

const axeSource = (axe as unknown as { source?: string }).source ?? '';

const ensureAxeInjected = async (page: Page): Promise<void> => {
  const alreadyInjected = await page.evaluate(() => typeof (window as typeof window & { axe?: unknown }).axe !== 'undefined').catch(() => false);
  if (alreadyInjected) return;
  if (!axeSource) {
    throw new Error('axe-core source not found; ensure dev dependency "axe-core" is installed.');
  }
  await page.addScriptTag({ content: axeSource });
};

export async function runA11ySmoke(page: Page, label: string, options: RunA11ySmokeOptions = {}): Promise<void> {
  await ensureAxeInjected(page);

  const selectors = Array.isArray(options.selectors)
    ? options.selectors.filter(Boolean)
    : options.selectors
      ? [options.selectors]
      : [];

  const includeBestPractices = options.includeBestPractices ?? false;
  const runOptions = options.runOptions ?? null;

  const results = await page.evaluate(async ({ selectors, includeBestPractices, runOptions, label }) => {
    const axeRuntime = (window as typeof window & { axe?: typeof axe }).axe;
    if (!axeRuntime) {
      console.warn('[runA11ySmoke]', label, 'axe-core was not injected; skipping checks.');
      return null;
    }

  const mergedOptions = { ...(runOptions ?? {}) } as RunOptions & { runOnly?: unknown };
    const runOnly = mergedOptions.runOnly;
    if (!runOnly) {
      mergedOptions.runOnly = {
        type: 'tag',
        values: includeBestPractices
          ? ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
          : ['wcag2a', 'wcag2aa', 'wcag21aa'],
      } as RunOnly;
    } else if (includeBestPractices) {
      if (typeof runOnly === 'string') {
        mergedOptions.runOnly = {
          type: 'tag',
          values: [runOnly, 'best-practice'],
        } as RunOnly;
      } else if (Array.isArray(runOnly)) {
        const values = Array.from(new Set([...runOnly, 'best-practice']));
        mergedOptions.runOnly = { type: 'tag', values } as RunOnly;
      } else if (runOnly && typeof runOnly === 'object') {
        const record = runOnly as { values?: string | string[] };
        if (record.values !== undefined) {
          const raw = record.values;
          const list = Array.isArray(raw) ? raw : [raw];
          const baseValues = list.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
          const values = Array.from(new Set([...baseValues, 'best-practice']));
          mergedOptions.runOnly = { type: 'tag', values } as RunOnly;
        }
      }
    }

    const context: ElementContext = selectors.length === 0
      ? document
      : selectors.length === 1
        ? selectors[0]
        : { include: selectors.map((selector) => [selector]) };

    const outcome = await axeRuntime.run(context as ElementContext, mergedOptions);

    const rawViolations = Array.isArray((outcome as { violations?: unknown[] }).violations)
      ? (outcome as { violations: unknown[] }).violations
      : [];

    const violations = rawViolations.map((entry): AxeViolationSummary => {
      const violation = (entry ?? {}) as Record<string, unknown>;
      const nodesRaw = Array.isArray(violation.nodes) ? (violation.nodes as unknown[]) : [];
      const nodes = nodesRaw.map((nodeEntry) => {
        const node = (nodeEntry ?? {}) as Record<string, unknown>;
        const targets = Array.isArray(node.target)
          ? (node.target as unknown[]).filter((value): value is string => typeof value === 'string')
          : [];
        return {
          html: typeof node.html === 'string' ? node.html : '',
          target: targets,
        };
      });
      const idRaw = violation.id;
      const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw : String(idRaw ?? 'violation');
      const impact = typeof violation.impact === 'string' ? violation.impact : null;
      const helpUrl = typeof violation.helpUrl === 'string' ? violation.helpUrl : undefined;
      const description = typeof violation.description === 'string' ? violation.description : undefined;
      return {
        id,
        impact,
        helpUrl,
        description,
        nodes,
      };
    });

    return { violations } satisfies AxeRunResult;
  }, { selectors, includeBestPractices, runOptions, label });

  if (!results) return;
  if (results.violations.length === 0) return;

  const summary = results.violations
    .map((violation) => {
      const impact = violation.impact ? ` (${violation.impact})` : '';
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(', ');
      return `${violation.id}${impact} → ${targets || '<no target>'}`;
    })
    .join('\n');

  throw new Error(`Axe violations detected for ${label}:\n${summary}`);
}

/**
 * Run a11y scan and return results (without throwing)
 * Use this for baseline tracking where violations are allowed but need to be reported
 */
export async function runA11yScan(page: Page, label: string, options: RunA11ySmokeOptions = {}): Promise<AxeRunResult | null> {
  await ensureAxeInjected(page);

  const selectors = Array.isArray(options.selectors)
    ? options.selectors.filter(Boolean)
    : options.selectors
      ? [options.selectors]
      : [];

  const includeBestPractices = options.includeBestPractices ?? false;
  const runOptions = options.runOptions ?? null;

  const results = await page.evaluate(async ({ selectors, includeBestPractices, runOptions, label }) => {
    const axeRuntime = (window as typeof window & { axe?: typeof axe }).axe;
    if (!axeRuntime) {
      console.warn('[runA11yScan]', label, 'axe-core was not injected; skipping checks.');
      return null;
    }

    const mergedOptions = { ...(runOptions ?? {}) } as RunOptions & { runOnly?: unknown };
    const runOnly = mergedOptions.runOnly;
    if (!runOnly) {
      mergedOptions.runOnly = {
        type: 'tag',
        values: includeBestPractices
          ? ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
          : ['wcag2a', 'wcag2aa', 'wcag21aa'],
      } as RunOnly;
    } else if (includeBestPractices) {
      if (typeof runOnly === 'string') {
        mergedOptions.runOnly = {
          type: 'tag',
          values: [runOnly, 'best-practice'],
        } as RunOnly;
      } else if (Array.isArray(runOnly)) {
        const values = Array.from(new Set([...runOnly, 'best-practice']));
        mergedOptions.runOnly = { type: 'tag', values } as RunOnly;
      } else if (runOnly && typeof runOnly === 'object') {
        const record = runOnly as { values?: string | string[] };
        if (record.values !== undefined) {
          const raw = record.values;
          const list = Array.isArray(raw) ? raw : [raw];
          const baseValues = list.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
          const values = Array.from(new Set([...baseValues, 'best-practice']));
          mergedOptions.runOnly = { type: 'tag', values } as RunOnly;
        }
      }
    }

    const context: ElementContext = selectors.length === 0
      ? document
      : selectors.length === 1
        ? selectors[0]
        : { include: selectors.map((selector) => [selector]) };

    const outcome = await axeRuntime.run(context as ElementContext, mergedOptions);

    const rawViolations = Array.isArray((outcome as { violations?: unknown[] }).violations)
      ? (outcome as { violations: unknown[] }).violations
      : [];

    const violations = rawViolations.map((entry): AxeViolationSummary => {
      const violation = (entry ?? {}) as Record<string, unknown>;
      const nodesRaw = Array.isArray(violation.nodes) ? (violation.nodes as unknown[]) : [];
      const nodes = nodesRaw.map((nodeEntry) => {
        const node = (nodeEntry ?? {}) as Record<string, unknown>;
        const targets = Array.isArray(node.target)
          ? (node.target as unknown[]).filter((value): value is string => typeof value === 'string')
          : [];
        return {
          html: typeof node.html === 'string' ? node.html : '',
          target: targets,
        };
      });
      const idRaw = violation.id;
      const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw : String(idRaw ?? 'violation');
      const impact = typeof violation.impact === 'string' ? violation.impact : null;
      const helpUrl = typeof violation.helpUrl === 'string' ? violation.helpUrl : undefined;
      const description = typeof violation.description === 'string' ? violation.description : undefined;
      return {
        id,
        impact,
        helpUrl,
        description,
        nodes,
      };
    });

    return { violations } satisfies AxeRunResult;
  }, { selectors, includeBestPractices, runOptions, label });

  return results;
}
