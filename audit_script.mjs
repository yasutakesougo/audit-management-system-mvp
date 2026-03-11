import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

const stats = {
  over400: [],
  over600: [],
  todos: [],
  anys: [],
  nonNullAsserts: [],
  mixedResponsibility: [],
};

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (fullPath.includes('.spec.') || fullPath.includes('.test.')) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const lineCount = lines.length;

      const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

      if (lineCount > 600) {
        stats.over600.push({ path: relPath, lines: lineCount });
      } else if (lineCount > 400) {
        stats.over400.push({ path: relPath, lines: lineCount });
      }

      if (/(?:TODO|FIXME|HACK|XXX)\b/i.test(content)) {
        stats.todos.push(relPath);
      }

      const anyMatches = (content.match(/\bany\b|\bas any\b|\bunknown as\b/g) || []);
      if (anyMatches.length > 0) {
        stats.anys.push({ path: relPath, count: anyMatches.length });
      }

      const nonNullAsserts = (content.match(/!\./g) || []).length;
      if (nonNullAsserts > 0) {
        stats.nonNullAsserts.push({ path: relPath, count: nonNullAsserts });
      }

      const hasUI = /<\w+/.test(content);
      const hasHook = /\buse[A-Z]\w+/.test(content);
      const hasType = /\b(?:export\s+)?(?:interface|type)\s+[A-Z]/.test(content);
      const hasHelper = /\b(?:export\s+)?const\s+[a-z]\w+\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/.test(content) || /\b(?:export\s+)?function\s+[a-z]/.test(content);

      // Avoid marking basic pages as mixed if they aren't big
      if (hasUI && hasHook && hasType && hasHelper && relPath.endsWith('.tsx') && lineCount > 200) {
          stats.mixedResponsibility.push({ path: relPath, lines: lineCount });
      }
    }
  }
}

walkDir(srcDir);

stats.over600.sort((a, b) => b.lines - a.lines);
stats.over400.sort((a, b) => b.lines - a.lines);
stats.anys.sort((a, b) => b.count - a.count);
stats.nonNullAsserts.sort((a, b) => b.count - a.count);
stats.mixedResponsibility.sort((a, b) => b.lines - a.lines);

console.log(JSON.stringify(stats, null, 2));
