/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HYDRATION_FEATURES } from '../src/hydration/features';
import type { HydrationFeatureEntry, HydrationFeatureTree } from '../src/hydration/features';
import { resolveHydrationEntry } from '../src/hydration/routes';
import { getFeatureFlags } from '../src/config/featureFlags';

type RouteEntry = {
  path: string;
  raw: string;
  file: string;
};

type RouteRow = {
  path: string;
  source: string;
  snippet: string;
  hydrationId?: string;
  hydrationBudgetMs?: number;
};

type FeatureGroup = {
  name: string;
  relativePath: string;
  subdirs: string[];
  files: string[];
};

type FeatureSpanRow = {
  key: string;
  id: string;
  label: string;
  budget: number;
  description?: string;
};

type TopLevelModule = {
  name: string;
  relativePath: string;
  kind: 'dir' | 'file';
};

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const OUTPUT_PATH = path.join(ROOT, 'system-map.md');

function safeStat(p: string): fs.Stats | null {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function listDir(p: string): fs.Dirent[] {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isTsLikeFile(name: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(name);
}

function collectTopLevel(): TopLevelModule[] {
  const entries = listDir(SRC_ROOT);
  return entries
    .map((entry) => ({
      name: entry.name,
      relativePath: path.posix.join('src', entry.name),
      kind: entry.isDirectory() ? 'dir' as const : 'file' as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectFeatures(): FeatureGroup[] {
  const featuresRoot = path.join(SRC_ROOT, 'features');
  const stats = safeStat(featuresRoot);
  if (!stats?.isDirectory()) return [];

  const featureDirs = listDir(featuresRoot).filter((entry) => entry.isDirectory());
  const groups: FeatureGroup[] = [];

  for (const dir of featureDirs) {
    const abs = path.join(featuresRoot, dir.name);
    const entries = listDir(abs);

    const subdirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const files = entries
      .filter((entry) => entry.isFile() && isTsLikeFile(entry.name))
      .map((entry) => entry.name)
      .sort();

    groups.push({
      name: dir.name,
      relativePath: path.posix.join('src', 'features', dir.name),
      subdirs,
      files,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function collectPages(): FeatureGroup[] {
  const pagesRoot = path.join(SRC_ROOT, 'pages');
  const stats = safeStat(pagesRoot);
  if (!stats?.isDirectory()) return [];

  const entries = listDir(pagesRoot);

  const rootFiles = entries
    .filter((entry) => entry.isFile() && isTsLikeFile(entry.name))
    .map((entry) => entry.name)
    .sort();

  const groups: FeatureGroup[] = [];

  if (rootFiles.length) {
    groups.push({
      name: '(root)',
      relativePath: path.posix.join('src', 'pages'),
      subdirs: [],
      files: rootFiles,
    });
  }

  for (const dir of entries.filter((entry) => entry.isDirectory())) {
    const abs = path.join(pagesRoot, dir.name);
    const children = listDir(abs);
    const files = children
      .filter((entry) => entry.isFile() && isTsLikeFile(entry.name))
      .map((entry) => entry.name)
      .sort();
    const subdirs = children.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

    groups.push({
      name: dir.name,
      relativePath: path.posix.join('src', 'pages', dir.name),
      subdirs,
      files,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function findRouterFile(): string | null {
  const candidates = [
    path.join(SRC_ROOT, 'app', 'router.tsx'),
    path.join(SRC_ROOT, 'app', 'router.ts'),
    path.join(SRC_ROOT, 'router.tsx'),
    path.join(SRC_ROOT, 'router.ts'),
  ];

  for (const candidate of candidates) {
    if (safeStat(candidate)?.isFile()) {
      return candidate;
    }
  }

  return null;
}

function extractRoutesFromSource(source: string, routerRelPath: string): RouteEntry[] {
  const routes: RouteEntry[] = [];

  const jsxRouteRegex = /<Route\s+[^>]*path\s*=\s*["'`]([^"'`]+)["'`][^>]*>/g;
  const objRouteRegex = /path\s*:\s*["'`]([^"'`]+)["'`]/g;

  const addRoute = (pathLiteral: string, raw: string) => {
    if (!routes.some((route) => route.path === pathLiteral)) {
      routes.push({
        path: pathLiteral,
        raw: raw.trim(),
        file: routerRelPath,
      });
    }
  };

  let match: RegExpExecArray | null;

  while ((match = jsxRouteRegex.exec(source))) {
    const full = match[0] ?? '';
    const routePath = match[1];
    if (routePath) {
      addRoute(routePath, full);
    }
  }

  while ((match = objRouteRegex.exec(source))) {
    const full = match[0] ?? '';
    const routePath = match[1];
    if (routePath) {
      addRoute(routePath, full);
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

function collectRoutes(): RouteEntry[] {
  const routerPath = findRouterFile();
  if (!routerPath) {
    console.warn('[generate-system-map] router.tsx not found; route section will be empty.');
    return [];
  }

  const source = fs.readFileSync(routerPath, 'utf8');
  const routerRelPath = path.posix.join('src', path.relative(SRC_ROOT, routerPath));

  return extractRoutesFromSource(source, routerRelPath);
}

const isHydrationFeatureEntry = (value: unknown): value is HydrationFeatureEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return 'id' in value && 'label' in value && 'budget' in value;
};

function flattenFeatureSpans(node: HydrationFeatureTree, prefix: string[] = []): FeatureSpanRow[] {
  const rows: FeatureSpanRow[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (isHydrationFeatureEntry(value)) {
      rows.push({
        key: [...prefix, key].join('.'),
        id: value.id,
        label: value.label,
        budget: value.budget,
        description: value.description,
      });
      continue;
    }
    if (value && typeof value === 'object') {
      rows.push(...flattenFeatureSpans(value as HydrationFeatureTree, [...prefix, key]));
    }
  }
  return rows;
}

function collectFeatureSpans(): FeatureSpanRow[] {
  const entries = flattenFeatureSpans(HYDRATION_FEATURES);
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return entries;
}

function buildRouteRows(routes: RouteEntry[]): RouteRow[] {
  return routes.map((route) => {
    const rawPath = route.path;
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const hydrationEntry = resolveHydrationEntry(normalizedPath, '');
    const snippet = route.raw.replace(/\s+/g, ' ').slice(0, 80);

    return {
      path: rawPath,
      source: route.file,
      snippet,
      hydrationId: hydrationEntry?.id ?? undefined,
      hydrationBudgetMs: hydrationEntry?.budget ?? undefined,
    } satisfies RouteRow;
  });
}

function formatTopLevelSection(mods: TopLevelModule[]): string {
  const lines: string[] = [];
  lines.push('## 1. Top-level modules under `src/`');
  lines.push('');
  lines.push('| Name | Kind | Path |');
  lines.push('| ---- | ---- | ---- |');

  for (const mod of mods) {
    lines.push(`| \`${mod.name}\` | ${mod.kind} | \`${mod.relativePath}\` |`);
  }

  lines.push('');
  return lines.join('\n');
}

function formatFeatureSection(title: string, groups: FeatureGroup[]): string {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push('');

  if (!groups.length) {
    lines.push('_No entries found._');
    lines.push('');
    return lines.join('\n');
  }

  for (const group of groups) {
    lines.push(`### \`${group.name}\``);
    lines.push('');
    lines.push(`- Root: \`${group.relativePath}\``);
    if (group.subdirs.length) {
      lines.push(`- Subdirs: ${group.subdirs.map((dir) => `\`${dir}\``).join(', ')}`);
    }
    if (group.files.length) {
      lines.push(`- Files: ${group.files.map((file) => `\`${file}\``).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatRouteSection(routes: RouteRow[]): string {
  const lines: string[] = [];
  lines.push('## 4. Routes (from router + hydration budgets)');
  lines.push('');

  if (!routes.length) {
    lines.push('_No route definitions detected (or router file missing)._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Path | Source file | Hydration ID | Budget (ms) | Snippet |');
  lines.push('| ---- | ----------- | ------------ | ----------- | ------- |');

  const formatRouteRow = (row: RouteRow): string => {
    const id = row.hydrationId ?? '';
    const budget = typeof row.hydrationBudgetMs === 'number' ? String(row.hydrationBudgetMs) : '';
    const snippet = row.snippet.replace(/\|/g, '\\|');
    return `| \`${row.path}\` | \`${row.source}\` | \`${id}\` | \`${budget}\` | \`${snippet}\` |`;
  };

  for (const route of routes) {
    lines.push(formatRouteRow(route));
  }

  lines.push('');
  return lines.join('\n');
}

function formatFeatureSpanSection(rows: FeatureSpanRow[]): string {
  const lines: string[] = [];
  lines.push('## 5. Feature-level hydration spans');
  lines.push('');

  if (!rows.length) {
    lines.push('_No feature spans registered in HYDRATION_FEATURES._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Key | Span ID | Label | Budget (ms) | Description |');
  lines.push('| --- | ------- | ----- | ----------- | ----------- |');

  rows.forEach((row) => {
    const description = row.description ? row.description.replace(/\|/g, '\\|') : '';
    lines.push(`| \`${row.key}\` | \`${row.id}\` | \`${row.label}\` | \`${row.budget}\` | ${description} |`);
  });

  lines.push('');
  return lines.join('\n');
}

function formatFeatureFlagsSection(): string {
  const snapshot = getFeatureFlags();
  const entries = Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b));

  const lines: string[] = [];
  lines.push('## 6. Feature Flags (resolved snapshot)');
  lines.push('');

  if (!entries.length) {
    lines.push('_No feature flags defined (getFeatureFlags() returned an empty snapshot)._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Flag | Value |');
  lines.push('| ---- | ----- |');

  for (const [key, value] of entries) {
    lines.push(`| \`${key}\` | \`${String(value)}\` |`);
  }

  lines.push('');
  return lines.join('\n');
}

function buildMarkdown(): string {
  const topLevel = collectTopLevel();
  const features = collectFeatures();
  const pages = collectPages();
  const routeEntries = collectRoutes();
  const routeRows = buildRouteRows(routeEntries);
  const featureSpanRows = collectFeatureSpans();

  const now = new Date().toISOString();

  const parts: string[] = [];
  parts.push('# System Map');
  parts.push('');
  parts.push('> ⚠️ This file is auto-generated by `scripts/generate-system-map.ts`.');
  parts.push(`> Generated at: \`${now}\``);
  parts.push('');
  parts.push(formatTopLevelSection(topLevel));
  parts.push(formatFeatureSection('2. Features (`src/features/*`)', features));
  parts.push(formatFeatureSection('3. Pages (`src/pages/*`)', pages));
  parts.push(formatRouteSection(routeRows));
  parts.push(formatFeatureSpanSection(featureSpanRows));
  parts.push(formatFeatureFlagsSection());

  return parts.join('\n');
}

function main(): void {
  const stats = safeStat(SRC_ROOT);
  if (!stats?.isDirectory()) {
    console.error('[generate-system-map] src/ directory not found. Aborting.');
    process.exitCode = 1;
    return;
  }

  const markdown = buildMarkdown();
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`[generate-system-map] Wrote system map to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();

export {
  buildMarkdown,
  buildRouteRows,
  collectFeatures,
  collectPages,
  collectRoutes,
  collectTopLevel,
  extractRoutesFromSource,
  formatFeatureSection,
  formatFeatureFlagsSection,
  formatRouteSection,
  formatTopLevelSection,
  main,
};
