import fs from 'node:fs';

const file = 'src/lib/spClient.ts';

if (!fs.existsSync(file)) {
  console.log('spClient: file not found, skipping.');
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');

const patched = source.replace(
  /(const\s+res\s*=\s*await\s*client\.spFetch[^\n]*;\s*)const\s+json\s*=\s*await\s*res\.json\(\)\.catch\(\(\)\s*=>\s*\(\{\s*value:\s*\[\]\s*\}\)\)\)\s*as\s*\{\s*value:\s*any\[\]\s*\};/gs,
  "$1const json = (!res || typeof (res as any).json !== 'function') ? ({ value: [] } as any) : await (res as any).json().catch(() => ({ value: [] })) as { value: any[] };"
);

if (patched === source) {
  console.log('spClient: no change.');
  process.exit(0);
}

fs.writeFileSync(file, patched);
console.log('spClient: json() guard applied.');
