import fs from 'node:fs';

const file = process.argv[2] || '/tmp/act-warnings-nightly.json';
if (!fs.existsSync(file)) {
  console.log('- summary: unavailable');
  process.exit(0);
}

const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const total = Number(s.totalWarnings || 0);
const affected = Number(s.affectedFiles || 0);
const maxFile = s.maxWarningsFile || 'none';
const maxCount = Number(s.maxWarningsPerFile || 0);
console.log(`- totalWarnings: **${total}**`);
console.log(`- affectedFiles: **${affected}**`);
console.log(`- maxWarningsFile: **${maxFile}**`);
console.log(`- maxWarningsPerFile: **${maxCount}**`);
