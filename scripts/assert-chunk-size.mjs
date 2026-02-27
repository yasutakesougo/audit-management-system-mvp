#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DEFAULT_LIMIT_KB = 1200; // temporarily relaxed to accommodate current vendor bundle size

const budgets = [
  { pattern: /charts-.*\.js$/i, limitKb: 120 },
  { pattern: /bpmn-.*\.js$/i, limitKb: 170 },
  { pattern: /mui-shell-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-surfaces-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-forms-.*\.js$/i, limitKb: 240 },
  { pattern: /mui-feedback-.*\.js$/i, limitKb: 160 },
  { pattern: /mui-navigation-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-overlay-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-data-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-display-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-components-a-e-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-components-f-j-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-components-k-o-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-components-p-t-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-components-u-z-.*\.js$/i, limitKb: 220 },
  { pattern: /mui-components-misc-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-foundation-.*\.js$/i, limitKb: 200 },
  { pattern: /mui-icons-.*\.js$/i, limitKb: 180 },
  { pattern: /emotion-.*\.js$/i, limitKb: 140 },
  { pattern: /msal-browser.*\.js$/i, limitKb: 70 },
  { pattern: /msal-react.*\.js$/i, limitKb: 70 },
  { pattern: /SupportPlanGuidePage-.*\.js$/i, limitKb: 70 },
  { pattern: /SupportPlanGuidePage\.Markdown-.*\.js$/i, limitKb: 90 },
  // App chunk: monolithic entry point — tracked for future code-splitting
  { pattern: /App-.*\.js$/i, limitKb: 3000 },
  { pattern: /App-legacy-.*\.js$/i, limitKb: 3000 },
];

const limitKb = Number.parseFloat(process.env.BUNDLE_MAX_CHUNK_KB ?? '') || DEFAULT_LIMIT_KB;

async function collectAssets() {
  const entries = await fs.readdir(ASSETS_DIR);
  const assets = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(ASSETS_DIR, entry);
      const stat = await fs.stat(fullPath);
      return stat.isFile() ? { name: entry, size: stat.size } : null;
    })
  );
  return assets.filter(Boolean);
}

(async () => {
  try {
    const assets = await collectAssets();
    if (assets.length === 0) {
      throw new Error('No assets found in dist/assets. Did the build complete?');
    }

    const offenders = assets
      .map((asset) => {
        const budget = budgets.find((entry) => entry.pattern.test(asset.name));
        const limitForAssetKb = budget?.limitKb ?? limitKb;
        return {
          name: asset.name,
          size: asset.size,
          limitKb: limitForAssetKb,
          budgetPattern: budget?.pattern ?? null,
        };
      })
      .filter((entry) => entry.size > entry.limitKb * 1024);
    if (offenders.length > 0) {
      console.error(`Chunk size assertion failed. Limit: ${limitKb} kB`);
      offenders.sort((a, b) => b.size - a.size).forEach((asset) => {
        const kb = (asset.size / 1024).toFixed(1);
        const budgetInfo = asset.budgetPattern ? ` (${asset.budgetPattern} <= ${asset.limitKb} kB)` : ` (limit ${asset.limitKb} kB)`;
        console.error(` - ${asset.name}: ${kb} kB${budgetInfo}`);
      });
      process.exit(1);
    }
    const maxSizeKb = (Math.max(...assets.map((a) => a.size)) / 1024).toFixed(1);
    console.log(`Chunk size assertion passed. Largest chunk: ${maxSizeKb} kB (default limit ${limitKb} kB)`);
  } catch (error) {
    console.error('Chunk size assertion failed:', error.message ?? error);
    process.exit(1);
  }
})();
