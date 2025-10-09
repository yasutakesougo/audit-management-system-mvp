import { execSync } from 'node:child_process';
import fs from 'node:fs';

const pattern = /(<input\b(?=[^>]*\btype="date")(?![^>]*\baria-label=))([^>]*>)/g;
const replacement = '$1 aria-label="日付"$2';

let fileList = '';
try {
  fileList = execSync("git ls-files '*.tsx' '*.jsx'", { encoding: 'utf8' });
} catch (error) {
  console.error('Failed to list TSX/JSX files', error);
  process.exitCode = 1;
  process.exit(1);
}

const files = fileList
  .split('\n')
  .map((file) => file.trim())
  .filter((file) => file.length > 0 && fs.existsSync(file));

if (!files.length) {
  console.log('No TSX/JSX files found.');
  process.exit(0);
}

let updatedCount = 0;
let touchedCount = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const next = original.replace(pattern, replacement);
  if (next !== original) {
    touchedCount += 1;
    fs.writeFileSync(file, next);
    const matches = next.match(pattern);
    updatedCount += matches ? matches.length : 1;
  }
}

if (touchedCount === 0) {
  console.log('No date inputs required updates.');
} else {
  console.log(`Updated aria-label on ${updatedCount} input(s) across ${touchedCount} file(s).`);
}
