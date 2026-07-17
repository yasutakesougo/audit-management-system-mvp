#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DEFAULT_LIMIT_KB = 1200;

const budgets = [
  { label: 'application shell', pattern: /App-(?!legacy-).*\.js$/i, limitKb: 800, required: true },
  { label: 'legacy application shell', pattern: /App-legacy-.*\.js$/i, limitKb: 800, required: true },
  { label: 'PDF renderer', pattern: /vendor-pdf-(?!legacy-).*\.js$/i, limitKb: 1750, required: true },
  { label: 'legacy PDF renderer', pattern: /vendor-pdf-legacy-.*\.js$/i, limitKb: 1750, required: true },
  { label: 'BlockNote editor', pattern: /MeetingMinutesBlockEditor-(?!legacy-).*\.js$/i, limitKb: 1100, required: true },
  { label: 'legacy BlockNote editor', pattern: /MeetingMinutesBlockEditor-legacy-.*\.js$/i, limitKb: 1250, required: true },
  { label: 'Excel export', pattern: /generateSupportProcedureExcel-(?!legacy-).*\.js$/i, limitKb: 1000, required: true },
  { label: 'legacy Excel export', pattern: /generateSupportProcedureExcel-legacy-.*\.js$/i, limitKb: 1000, required: true },
  { label: 'React Core', pattern: /react-(?!legacy-).*\.js$/i, limitKb: 850, required: true },
  { label: 'legacy React Core', pattern: /react-legacy-.*\.js$/i, limitKb: 850, required: true },
  { label: 'MUI Framework', pattern: /mui-(?!legacy-).*\.js$/i, limitKb: 700, required: true },
  { label: 'legacy MUI Framework', pattern: /mui-legacy-.*\.js$/i, limitKb: 700, required: true },
  { label: 'Firebase SDK', pattern: /firebase-(?!legacy-).*\.js$/i, limitKb: 650, required: true },
  { label: 'legacy Firebase SDK', pattern: /firebase-legacy-.*\.js$/i, limitKb: 825, required: true },
  { label: 'SupportPlanningSheetPage', pattern: /SupportPlanningSheetPage-(?!legacy-).*\.js$/i, limitKb: 330, required: true },
  { label: 'legacy SupportPlanningSheetPage', pattern: /SupportPlanningSheetPage-legacy-.*\.js$/i, limitKb: 330, required: true },
  { label: 'MonthlyRecordPage', pattern: /MonthlyRecordPage-(?!legacy-).*\.js$/i, limitKb: 60, required: true },
  { label: 'legacy MonthlyRecordPage', pattern: /MonthlyRecordPage-legacy-.*\.js$/i, limitKb: 60, required: true },
  { label: 'SupportPlanGuidePage', pattern: /SupportPlanGuidePage-(?!legacy-).*\.js$/i, limitKb: 40, required: true },
  { label: 'legacy SupportPlanGuidePage', pattern: /SupportPlanGuidePage-legacy-.*\.js$/i, limitKb: 40, required: true },
  { pattern: /recharts-.*\.js$/i, limitKb: 500 },
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
  { pattern: /SupportPlanGuidePage\.Markdown-.*\.js$/i, limitKb: 90 },
  // vendor-reports: xlsx + @react-pdf (lazy-loaded on export only)
  { pattern: /vendor-reports-.*\.js$/i, limitKb: 2000 },
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

    const missingBudgets = budgets.filter(
      (budget) => budget.required && !assets.some((asset) => budget.pattern.test(asset.name)),
    );
    if (missingBudgets.length > 0) {
      console.error('Chunk size assertion failed. Required budget targets were not found:');
      missingBudgets.forEach((budget) => {
        console.error(` - ${budget.label}: ${budget.pattern}`);
      });
      process.exit(1);
    }

    const offenders = assets
      .map((asset) => {
        const budget = budgets.find((entry) => entry.pattern.test(asset.name));
        const limitForAssetKb = budget?.limitKb ?? limitKb;
        return {
          name: asset.name,
          size: asset.size,
          limitKb: limitForAssetKb,
          budgetLabel: budget?.label ?? null,
        };
      })
      .filter((entry) => entry.size > entry.limitKb * 1024);
    if (offenders.length > 0) {
      console.error(`Chunk size assertion failed. Limit: ${limitKb} kB`);
      offenders.sort((a, b) => b.size - a.size).forEach((asset) => {
        const kb = (asset.size / 1024).toFixed(1);
        const budgetInfo = asset.budgetLabel
          ? ` (${asset.budgetLabel} <= ${asset.limitKb} kB)`
          : ` (limit ${asset.limitKb} kB)`;
        console.error(` - ${asset.name}: ${kb} kB${budgetInfo}`);
      });
      process.exit(1);
    }
    const maxSizeKb = (Math.max(...assets.map((a) => a.size)) / 1024).toFixed(1);
    console.log(`Chunk size assertion passed. Largest chunk: ${maxSizeKb} kB (default limit ${limitKb} kB)`);
    budgets.filter((budget) => budget.required).forEach((budget) => {
      const asset = assets.find((entry) => budget.pattern.test(entry.name));
      console.log(` - ${budget.label}: ${(asset.size / 1024).toFixed(1)} kB / ${budget.limitKb} kB`);
    });
  } catch (error) {
    console.error('Chunk size assertion failed:', error.message ?? error);
    process.exit(1);
  }
})();
