import * as fs from 'node:fs';
import * as path from 'node:path';
import { FeatureMapEntry } from './system-map/types';
import { getFeatureNames, countFilesInDir } from './system-map/scanFeatures';
import { extractRoutes } from './system-map/extractRoutes';
import { extractStorage } from './system-map/extractStorage';
import { extractBridges } from './system-map/extractBridges';
import { renderMarkdown } from './system-map/renderMarkdown';
import { FEATURE_METADATA } from './system-map/metadata';

function main() {
  const rootDir = process.cwd();
  const srcRoot = path.join(rootDir, 'src');
  
  if (!fs.existsSync(srcRoot)) {
    console.error('Run this from the project root.');
    process.exit(1);
  }

  const featureNames = getFeatureNames(srcRoot);
  const entries: FeatureMapEntry[] = [];

  for (const feature of featureNames) {
    const metadata = FEATURE_METADATA[feature];
    const isUnknown = !metadata;
    
    const layer = metadata?.layer || 'Unknown';
    const maturity = metadata?.maturity || 'Unknown';
    const prod = metadata?.prod ?? 'unknown';

    const routes = extractRoutes(srcRoot, feature);
    const storage = extractStorage(srcRoot, feature);
    const bridges = extractBridges(srcRoot, feature);
    const filesCount = countFilesInDir(path.join(srcRoot, 'features', feature));

    entries.push({
      feature,
      layer,
      maturity,
      prod,
      routes,
      storage,
      bridges,
      filesCount,
      reviewRequired: isUnknown,
    });
  }

  // Generate output files
  const outJson = path.join(rootDir, 'system-map-v2.json');
  const outMd = path.join(rootDir, 'system-map-v2.md');

  fs.writeFileSync(outJson, JSON.stringify(entries, null, 2), 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(entries), 'utf8');

  console.log(`[generate-system-map-v2] Generated successfully!`);
  console.log(`  JSON: ${outJson}`);
  console.log(`  Markdown: ${outMd}`);
  
  const missing = entries.filter(e => e.reviewRequired).map(e => e.feature);
  if (missing.length > 0) {
    console.warn(`\n[WARNING] Found ${missing.length} unclassified features (add them to metadata.ts):`);
    console.warn(`  ${missing.join(', ')}`);
  }
}

main();
