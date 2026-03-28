import * as fs from 'node:fs';
import * as path from 'node:path';
import { RouteRef } from './types';

export function extractRoutes(srcRoot: string, feature: string): RouteRef[] {
  const routes: RouteRef[] = [];
  const lazyPagesPath = path.join(srcRoot, 'app', 'routes', 'lazyPages.tsx');
  if (!fs.existsSync(lazyPagesPath)) return routes;

  const lazyPagesContent = fs.readFileSync(lazyPagesPath, 'utf8');
  
  // React.lazy や lazyWithPreload で紐付くコンポーネント名を抽出
  const componentNames: string[] = [];
  const regexPatterns = [
    new RegExp(`const\\s+([A-Za-z0-9_]+)\\s*=\\s*React\\.lazy[\\s\\S]*?['"\`]@/features/${feature}/`, 'g'),
    new RegExp(`const\\s+([A-Za-z0-9_]+)\\s*=\\s*lazyWithPreload[\\s\\S]*?['"\`]@/features/${feature}/`, 'g')
  ];

  for (const regex of regexPatterns) {
    let match;
    while ((match = regex.exec(lazyPagesContent)) !== null) {
      componentNames.push(match[1]);
    }
  }

  const routesDir = path.join(srcRoot, 'app', 'routes');
  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('Routes.tsx') || f === 'router.tsx');
    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      
      for (const comp of componentNames) {
        // 例: <SuspendedSomePage />
        const suspendedName = `Suspended${comp}`;
        const regex = new RegExp(`path\\s*:\\s*['"\`]([^'"\`]+)['"\`][\\s\\S]*?<(${suspendedName}|${comp})`, 'g');
        let rMatch;
        while ((rMatch = regex.exec(content)) !== null) {
          routes.push({
            path: rMatch[1],
            file: `app/routes/${file}`,
            kind: 'lazy'
          });
        }
      }
    }
  }

  // ダイレクトに @/features/xxx をインポートしている Route 定義の推測 (Fallback)
  if (routes.length === 0 && fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('Routes.tsx') || f === 'router.tsx');
    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      if (content.includes(`@/features/${feature}`)) {
         const routeMatches = Array.from(content.matchAll(/path\s*:\s*['"`]([^'"`]+)['"`]/g));
         if (routeMatches.length > 0) {
           routes.push({
             path: routeMatches[0][1] + ' (approx)',
             file: `app/routes/${file}`,
             kind: 'derived'
           });
         }
      }
    }
  }

  // 重複排除
  const uniqueUrls = new Set<string>();
  return routes.filter(r => {
    if (uniqueUrls.has(r.path)) return false;
    uniqueUrls.add(r.path);
    return true;
  });
}
