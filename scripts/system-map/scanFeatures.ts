import * as fs from 'node:fs';
import * as path from 'node:path';

export function getFeatureNames(srcRoot: string): string[] {
  const featuresPath = path.join(srcRoot, 'features');
  if (!fs.existsSync(featuresPath)) return [];
  return fs.readdirSync(featuresPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

export function countFilesInDir(dirPath: string): number {
  let count = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFilesInDir(path.join(dirPath, entry.name));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      count++;
    }
  }
  return count;
}
