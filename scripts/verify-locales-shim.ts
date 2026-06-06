import * as originalLocales from '../node_modules/@blocknote/core/dist/locales.js';
import * as shimLocales from '../src/shims/blocknote-locales-shim';

const originalKeys = Object.keys(originalLocales).sort();
const shimKeys = Object.keys(shimLocales).sort();

console.log("Verifying locales shim exports...");
console.log("Original keys:", originalKeys);
console.log("Shim keys:", shimKeys);

let hasMismatch = false;

// Verify count
if (originalKeys.length !== shimKeys.length) {
  console.error(`Mismatch in export count: Original has ${originalKeys.length}, Shim has ${shimKeys.length}`);
  hasMismatch = true;
}

// Verify each key existence
for (const key of originalKeys) {
  if (!(key in shimLocales)) {
    console.error(`Missing key in shim: ${key}`);
    hasMismatch = true;
  }
}

if (hasMismatch) {
  console.error("Locales shim verification FAILED!");
  process.exit(1);
}

console.log("Locales shim verified successfully!");
process.exit(0);
