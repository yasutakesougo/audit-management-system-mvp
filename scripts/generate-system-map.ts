/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import type { ArrayLiteralExpression, ObjectLiteralExpression, VariableDeclaration, FunctionDeclaration } from 'ts-morph';
import { HYDRATION_FEATURES } from '../src/hydration/features';
import type { HydrationFeatureEntry, HydrationFeatureTree } from '../src/hydration/features';
import { resolveHydrationEntry } from '../src/hydration/routes';
import { getFeatureFlags } from '../src/config/featureFlags';
import { getStandaloneHubIds, getHubRootPath } from '../src/app/hubs/hubDefinitions';
import { computeNavigationDiagnostics } from '../src/app/navigation/diagnostics/navigationDiagnostics';
import { APP_ROUTE_PATHS } from '../src/app/routes/appRoutePaths';
import { isDynamicPattern, matchDynamic, normalizePath, normalizeRouterPath, ORPHAN_ALLOWLIST, ORPHAN_ALLOWLIST_DETAILS } from '../src/app/navigation/diagnostics/pathUtils';

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
      kind: entry.isDirectory() ? ('dir' as const) : ('file' as const),
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

function parseInitializer(
  node: any,
  parentPath: string,
  fileRelPath: string,
  routeEntries: RouteEntry[]
): void {
  const kind = node.getKind();

  if (kind === SyntaxKind.ArrayLiteralExpression) {
    const array = node as ArrayLiteralExpression;
    for (const elem of array.getElements()) {
      parseInitializer(elem, parentPath, fileRelPath, routeEntries);
    }
  } else if (kind === SyntaxKind.ObjectLiteralExpression) {
    parseRouteObject(node as ObjectLiteralExpression, parentPath, fileRelPath, routeEntries);
  } else if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
    const body = node.getBody();
    if (body) {
      if (body.getKind() === SyntaxKind.Block) {
        const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        for (const ret of returns) {
          const expr = ret.getExpression();
          if (expr) {
            parseInitializer(expr, parentPath, fileRelPath, routeEntries);
          }
        }
      } else {
        parseInitializer(body, parentPath, fileRelPath, routeEntries);
      }
    }
  } else if (kind === SyntaxKind.ParenthesizedExpression) {
    const expr = node.getExpression();
    if (expr) {
      parseInitializer(expr, parentPath, fileRelPath, routeEntries);
    }
  }
}

function parseRouteObject(
  obj: ObjectLiteralExpression,
  parentPath: string,
  fileRelPath: string,
  routeEntries: RouteEntry[]
): void {
  const pathProp = obj.getProperty('path');
  const indexProp = obj.getProperty('index');
  const childrenProp = obj.getProperty('children');

  let currentPathSegment = '';
  if (pathProp) {
    const init = pathProp.getKind() === SyntaxKind.PropertyAssignment 
      ? (pathProp as any).getInitializer() 
      : null;
    if (init) {
      currentPathSegment = init.getText().replace(/^['"`]|['"`]$/g, '');
    }
  }

  let fullPath = parentPath;
  if (currentPathSegment) {
    if (fullPath) {
      const parentEndsWithSlash = fullPath.endsWith('/');
      const childStartsWithSlash = currentPathSegment.startsWith('/');
      if (parentEndsWithSlash && childStartsWithSlash) {
        fullPath = fullPath + currentPathSegment.slice(1);
      } else if (!parentEndsWithSlash && !childStartsWithSlash) {
        fullPath = fullPath + '/' + currentPathSegment;
      } else {
        fullPath = fullPath + currentPathSegment;
      }
    } else {
      fullPath = currentPathSegment;
    }
  }

  let isRoute = false;
  if (pathProp) {
    isRoute = true;
  } else if (indexProp) {
    const init = indexProp.getKind() === SyntaxKind.PropertyAssignment 
      ? (indexProp as any).getInitializer() 
      : null;
    if (init && init.getText() === 'true') {
      isRoute = true;
    }
  }

  if (isRoute) {
    routeEntries.push({
      path: fullPath || '/',
      raw: obj.getText().replace(/\s+/g, ' ').slice(0, 100),
      file: fileRelPath,
    });
  }

  if (childrenProp) {
    const init = childrenProp.getKind() === SyntaxKind.PropertyAssignment 
      ? (childrenProp as any).getInitializer() 
      : null;
    if (init) {
      parseInitializer(init, fullPath, fileRelPath, routeEntries);
    }
  }
}

// Shared Project instance configured for performance
const project = new Project({
  skipLoadingLibFiles: true,
  skipAddingFilesFromTsConfig: true,
});

function extractRoutesFromAST(filePath: string): RouteEntry[] {
  let sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    sourceFile = project.addSourceFileAtPath(filePath);
  }
  const routeEntries: RouteEntry[] = [];
  const fileRelPath = path.relative(ROOT, filePath).split(path.sep).join(path.posix.sep);

  const exportedDeclarations = sourceFile.getExportedDeclarations();
  
  for (const decls of exportedDeclarations.values()) {
    for (const decl of decls) {
      if (decl.getKind() === SyntaxKind.VariableDeclaration) {
        const varDecl = decl as VariableDeclaration;
        const initializer = varDecl.getInitializer();
        if (initializer) {
          parseInitializer(initializer, '', fileRelPath, routeEntries);
        }
      } else if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcDecl = decl as FunctionDeclaration;
        const returns = funcDecl.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        for (const ret of returns) {
          const expr = ret.getExpression();
          if (expr) {
            parseInitializer(expr, '', fileRelPath, routeEntries);
          }
        }
      }
    }
  }

  return routeEntries;
}

function collectRouteSourceFiles(): string[] {
  const files = new Set<string>();
  const routerPath = findRouterFile();
  if (routerPath) {
    files.add(routerPath);
  }

  const routeRoots = [
    path.join(SRC_ROOT, 'app', 'routes'),
    path.join(SRC_ROOT, 'features', 'nurse', 'routes'),
  ];

  for (const routeRoot of routeRoots) {
    for (const entry of listDir(routeRoot)) {
      if (!entry.isFile() || !/Routes?\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      files.add(path.join(routeRoot, entry.name));
    }
  }

  return [...files].sort();
}

function collectRoutes(): RouteEntry[] {
  const routeSourceFiles = collectRouteSourceFiles();
  if (!routeSourceFiles.length) {
    console.warn('[generate-system-map] route source files not found; route section will be empty.');
    return [];
  }

  const astRoutes = routeSourceFiles.flatMap((routeSourcePath) => {
    // Router definition itself (router.tsx) is just for composition, skip it to avoid duplication.
    if (routeSourcePath.endsWith('router.tsx') || routeSourcePath.endsWith('router.ts')) {
      return [];
    }
    return extractRoutesFromAST(routeSourcePath);
  });

  const hubRoutes = getStandaloneHubIds().map((hubId) => {
    const rootPath = getHubRootPath(hubId);
    const pathLiteral = rootPath.replace(/^\//, ''); // Strip leading slash
    return {
      path: pathLiteral,
      raw: `createStandaloneHubLandingRoute('${hubId}')`,
      file: 'src/app/routes/hubRoutes.tsx',
    };
  });

  const allRoutes = [...astRoutes, ...hubRoutes];

  return allRoutes
    .filter((route, index, entries) =>
      entries.findIndex((candidate) => candidate.path === route.path && candidate.file === route.file) === index)
    .sort((a, b) => a.path.localeCompare(b.path) || a.file.localeCompare(b.file));
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

function formatDiagnosticsSection(routes: RouteRow[]): string {
  // 1. Duplicate Routes (based on AST-extracted routes)
  const duplicates = new Map<string, RouteRow[]>();
  routes.forEach((route) => {
    const norm = normalizeRouterPath(normalizePath(route.path));
    if (!duplicates.has(norm)) {
      duplicates.set(norm, []);
    }
    duplicates.get(norm)!.push(route);
  });
  const duplicateRows = [...duplicates.entries()]
    .filter(([_, list]) => list.length > 1)
    .map(([path, list]) => ({ path, list }));

  // 2. Navigation Targets exposure (cross-reference based on APP_ROUTE_PATHS)
  const routerPathSet = new Set(APP_ROUTE_PATHS.map(normalizeRouterPath));

  const roles: ('admin' | 'reception' | 'staff')[] = ['admin', 'reception', 'staff'];
  const activeNavHrefs = new Set<string>();

  roles.forEach((role) => {
    const result = computeNavigationDiagnostics({
      role,
      schedulesEnabled: true,
      complianceFormEnabled: true,
      icebergPdcaEnabled: true,
      staffAttendanceEnabled: true,
      todayOpsEnabled: true,
    });
    result.navItemsFlat.concat(result.footerItemsFlat).forEach((item) => {
      if (item.visible) {
        activeNavHrefs.add(normalizePath(item.href));
      }
    });
  });

  const matchesAnyRoute = (href: string): boolean => {
    const normHref = normalizeRouterPath(normalizePath(href));
    if (routerPathSet.has(normHref)) return true;
    return [...routerPathSet].some((rp) => isDynamicPattern(rp) && matchDynamic(normHref, rp));
  };

  // Dead Links: Exposed in nav config, but not present in router (APP_ROUTE_PATHS)
  const deadLinks: string[] = [];
  for (const href of activeNavHrefs) {
    if (href.startsWith('/nurse')) continue; // Skip nurse namespace nested targets
    if (!matchesAnyRoute(href)) {
      deadLinks.push(href);
    }
  }

  // Orphan Routes: Present in router (APP_ROUTE_PATHS), but not exposed in nav
  const orphanRoutes: string[] = [];
  const allowlistedOrphans: string[] = [];

  for (const routerPath of routerPathSet) {
    let isExposed = activeNavHrefs.has(routerPath) || 
      [...activeNavHrefs].some((href) => isDynamicPattern(routerPath) && matchDynamic(href, routerPath));

    if (!isExposed) {
      let isAllowlisted = ORPHAN_ALLOWLIST.has(routerPath) || 
        [...ORPHAN_ALLOWLIST].some((p) => isDynamicPattern(p) && matchDynamic(routerPath, p));
      
      if (isAllowlisted) {
        allowlistedOrphans.push(routerPath);
      } else {
        orphanRoutes.push(routerPath);
      }
    }
  }

  const lines: string[] = [];
  lines.push('## 7. Routing Diagnostics & Consistency');
  lines.push('');

  // Duplicates
  lines.push('### Duplicate Routes');
  lines.push('');
  if (duplicateRows.length === 0) {
    lines.push('_No duplicate routes detected._');
    lines.push('');
  } else {
    lines.push('| Path | Occurrences | Source Files |');
    lines.push('| ---- | ----------- | ------------ |');
    duplicateRows.forEach(({ path, list }) => {
      const sources = list.map((r) => `\`${r.source}\``).join(', ');
      lines.push(`| \`${path}\` | ${list.length} | ${sources} |`);
    });
    lines.push('');
  }

  // Dead Links
  lines.push('### Exposed Navigation Hrefs Missing in Router (Dead Links)');
  lines.push('');
  if (deadLinks.length === 0) {
    lines.push('_No dead links detected._');
    lines.push('');
  } else {
    lines.push('| Exposed Nav Path | Status |');
    lines.push('| ---------------- | ------ |');
    deadLinks.forEach((link) => {
      lines.push(`| \`${link}\` | ❌ Dead Link |`);
    });
    lines.push('');
  }

  // Orphan Routes
  lines.push('### Orphan Routes (Active Router Paths not exposed in Navigation)');
  lines.push('');
  if (orphanRoutes.length === 0) {
    lines.push('_No active orphan routes detected._');
    lines.push('');
  } else {
    lines.push('| Path | Status |');
    lines.push('| ---- | ------ |');
    orphanRoutes.forEach((orphan) => {
      lines.push(`| \`${orphan}\` | ⚠️ Orphaned |`);
    });
    lines.push('');
  }

  // Allowlisted Orphans
  lines.push('### Allowlisted Orphans (Intentionally unexposed routes)');
  lines.push('');
  if (allowlistedOrphans.length === 0) {
    lines.push('_No allowlisted orphans detected._');
    lines.push('');
  } else {
    lines.push('| Path | Reason |');
    lines.push('| ---- | ------ |');
    allowlistedOrphans.forEach((orphan) => {
      const details = ORPHAN_ALLOWLIST_DETAILS.find((d) => d.path === orphan);
      const reason = details ? details.reason : 'No reason specified';
      lines.push(`| \`${orphan}\` | ${reason} |`);
    });
    lines.push('');
  }

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
  parts.push(formatDiagnosticsSection(routeRows));

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
  collectRouteSourceFiles,
  collectRoutes,
  collectTopLevel,
  extractRoutesFromAST,
  formatFeatureSection,
  formatFeatureFlagsSection,
  formatRouteSection,
  formatTopLevelSection,
  formatDiagnosticsSection,
  main,
};
