/* eslint-disable no-console -- CI security guard */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CREDENTIAL_PATTERNS = [
  /\bBearer\s+[^\s"'<>]+/i,
  /\bAuthorization\s*[:=]/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

function collectFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  if (!stat.isDirectory()) return [];

  return fs.readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(targetPath, entry.name);
    return entry.isDirectory() ? collectFiles(childPath) : entry.isFile() ? [childPath] : [];
  });
}

export function findUnsafePatrolArtifacts(targetPaths, options = {}) {
  const token = String(options.token ?? '').trim();
  const files = targetPaths.flatMap(collectFiles);

  return files.filter((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    if (token && content.includes(token)) return true;
    return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content));
  });
}

export function assertPatrolArtifactsSafe(targetPaths, options = {}) {
  const unsafeFiles = findUnsafePatrolArtifacts(targetPaths, options);
  if (unsafeFiles.length > 0) {
    throw new Error(`Credential-like material detected in ${unsafeFiles.length} patrol artifact file(s).`);
  }
  return { scannedFiles: targetPaths.flatMap(collectFiles).length };
}

async function main() {
  const targetPaths = process.argv.slice(2);
  if (targetPaths.length === 0) {
    console.error('[patrol-artifact-scan] No artifact path was provided.');
    process.exitCode = 1;
    return;
  }

  try {
    const result = assertPatrolArtifactsSafe(targetPaths, { token: process.env.SP_TOKEN });
    console.log(`[patrol-artifact-scan] Passed: ${result.scannedFiles} file(s) scanned.`);
  } catch (error) {
    console.error(`[patrol-artifact-scan] Blocked: ${error instanceof Error ? error.message : 'Artifact scan failed.'}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  await main();
}
