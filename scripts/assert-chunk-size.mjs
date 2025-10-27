#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DEFAULT_LIMIT_KB = 1024; // 1 MB

const limitKb = Number.parseFloat(process.env.BUNDLE_MAX_CHUNK_KB ?? '') || DEFAULT_LIMIT_KB;
const limitBytes = limitKb * 1024;

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

    const offenders = assets.filter((asset) => asset.size > limitBytes);
    if (offenders.length > 0) {
      console.error(`Chunk size assertion failed. Limit: ${limitKb} kB`);
      offenders.sort((a, b) => b.size - a.size).forEach((asset) => {
        const kb = (asset.size / 1024).toFixed(1);
        console.error(` - ${asset.name}: ${kb} kB`);
      });
      process.exit(1);
    }

    console.log(`Chunk size assertion passed. Max chunk: ${(Math.max(...assets.map((a) => a.size)) / 1024).toFixed(1)} kB (limit ${limitKb} kB)`);
  } catch (error) {
    console.error('Chunk size assertion failed:', error.message ?? error);
    process.exit(1);
  }
})();
