import fs from 'fs';

const statsJson = fs.readFileSync('stats.json', 'utf8');
const stats = JSON.parse(statsJson);

// find the app chunk
const chunks = stats.chunks || [];
const appChunk = chunks.find(c => c.fileName.includes('App-legacy') || c.fileName.includes('App-'));

if (!appChunk) {
  console.log('App chunk not found!');
  process.exit(1);
}

console.log(`Analyzing chunk: ${appChunk.fileName}`);

const modules = Object.entries(appChunk.modules)
  .map(([id, mod]) => ({ id, size: mod.renderedLength }))
  .sort((a, b) => b.size - a.size);

console.log('Top 20 largest modules in App chunk:');
for (let i = 0; i < 20 && i < modules.length; i++) {
  console.log(`${modules[i].id}: ${(modules[i].size / 1024).toFixed(2)} kB`);
}
