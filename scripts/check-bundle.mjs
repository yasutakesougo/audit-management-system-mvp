#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

async function readAssetStats() {
  try {
    const entries = await fs.readdir(ASSETS_DIR);
    const files = await Promise.all(
      entries.map(async (name) => {
        const fullPath = path.join(ASSETS_DIR, name);
        const stat = await fs.stat(fullPath);
        return stat.isFile() ? { name, size: stat.size } : null;
      })
    );
    return files.filter(Boolean);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error('Bundle check failed: dist/assets not found. Run "npm run build" first.');
      process.exitCode = 1;
      return [];
    }
    throw error;
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function main() {
  const stats = await readAssetStats();
  if (!stats.length) {
    if (process.exitCode !== 1) {
      console.warn('No bundle assets detected. Skipping report.');
    }
    return;
  }

  stats.sort((a, b) => b.size - a.size);
  const largest = stats.slice(0, 10);

  console.log('Bundle artifacts (top 10 by size):');
  largest.forEach(({ name, size }, index) => {
    console.log(`${String(index + 1).padStart(2, ' ')}. ${name} – ${formatSize(size)}`);
  });
}

main().catch((error) => {
  console.error('Bundle check failed:', error);
  process.exitCode = 1;
});
