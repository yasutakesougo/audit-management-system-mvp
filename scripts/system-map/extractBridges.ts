import * as fs from 'node:fs';
import * as path from 'node:path';
import { BridgeRef } from './types';

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      getAllFiles(filepath, fileList);
    } else if (/\.(ts|tsx)$/.test(filepath)) {
      fileList.push(filepath);
    }
  }
  return fileList;
}

export function extractBridges(srcRoot: string, feature: string): BridgeRef[] {
  const featureDir = path.join(srcRoot, 'features', feature);
  const files = getAllFiles(featureDir);
  const bridges: BridgeRef[] = [];

  for (const file of files) {
    const basename = path.basename(file);
    if (/(Bridge|Pipeline|Builder|Sync)[A-Z]?.*\.tsx?$/i.test(basename) && !basename.includes('.spec.')) {
      
      let kind: BridgeRef['kind'] = 'bridge';
      if (/pipeline/i.test(basename)) kind = 'pipeline';
      if (/builder/i.test(basename)) kind = 'builder';

      bridges.push({
        name: basename.replace(/\.tsx?$/, ''),
        file: path.relative(srcRoot, file).replace(/\\/g, '/'),
        kind
      });
    }
  }

  return bridges;
}
