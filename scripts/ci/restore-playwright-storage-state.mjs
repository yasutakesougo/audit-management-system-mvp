import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function decodeStorageState(encoded) {
  if (!String(encoded ?? '').trim()) {
    throw new Error('PW_STORAGE_STATE_B64 is empty. Regenerate the Playwright storage state and update the GitHub secret.');
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  let state;
  try {
    state = JSON.parse(decoded);
  } catch {
    throw new Error('PW_STORAGE_STATE_B64 is not valid base64-encoded JSON.');
  }

  if (!Array.isArray(state.cookies) || state.cookies.length === 0) {
    throw new Error('Decoded Playwright storageState has no cookies. Regenerate PW_STORAGE_STATE_B64.');
  }
  return state;
}

export function restoreStorageState(encoded, outputPath = path.resolve('tests/.auth/storageState.json')) {
  const state = decodeStorageState(encoded);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  return outputPath;
}

function main() {
  try {
    const outputPath = restoreStorageState(process.env.PW_STORAGE_STATE_B64);
    console.log(`Playwright storageState restored to ${outputPath}`);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
