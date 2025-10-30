#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TESTIDS_PATH = path.join(ROOT, 'src', 'testids.ts');

if (!fs.existsSync(TESTIDS_PATH)) {
  console.error('Unable to find src/testids.ts.');
  process.exit(1);
}

const testidsContent = fs.readFileSync(TESTIDS_PATH, 'utf8');
const keyPattern = /['"]([A-Za-z0-9_-]+)['"]\s*:\s*['"]/g;
const declaredKeys = new Set();
let match;
while ((match = keyPattern.exec(testidsContent)) !== null) {
  declaredKeys.add(match[1]);
}

if (!declaredKeys.size) {
  console.error('No TESTIDS keys could be parsed from src/testids.ts.');
  process.exit(2);
}

const usagePattern = /TESTIDS\[\s*['"`]([A-Za-z0-9_-]+)['"`]\s*\]/g;
const searchRoots = ['src', 'tests'];
const missingKeys = new Set();

const shouldSkipDir = (dirName) => ['node_modules', '.git', 'dist', 'coverage', 'playwright-report', 'test-results'].includes(dirName);

function scanDirectory(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    console.error(`Unable to read directory ${dirPath}:`, error.message);
    process.exit(1);
  }

  for (const entry of entries) {
    if (shouldSkipDir(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;

    let fileContents;
    try {
      fileContents = fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.error(`Unable to read file ${fullPath}:`, error.message);
      process.exit(1);
    }

    let useMatch;
    while ((useMatch = usagePattern.exec(fileContents)) !== null) {
      const key = useMatch[1];
      if (!declaredKeys.has(key)) {
        missingKeys.add(key);
      }
    }
  }
}

for (const root of searchRoots) {
  const absoluteRoot = path.join(ROOT, root);
  if (fs.existsSync(absoluteRoot)) {
    scanDirectory(absoluteRoot);
  }
}

if (missingKeys.size) {
  console.error('Missing TESTIDS keys referenced in code:', Array.from(missingKeys).sort().join(', '));
  console.error('Please add them to src/testids.ts.');
  process.exit(1);
}

console.log('All TESTIDS usages are declared.');
