const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');
const redirectsPath = path.join(distDir, '_redirects');

const isNetlifyBuild = Boolean(process.env.NETLIFY);

if (!isNetlifyBuild) {
  console.log('[netlify] skip _redirects generation (not a Netlify build)');
  process.exit(0);
}

// Ensure dist exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write _redirects file (Netlify SPA fallback)
const redirectsContent = '/*    /index.html   200\n';
fs.writeFileSync(redirectsPath, redirectsContent, 'utf8');

console.log(`[netlify] wrote ${redirectsPath}`);
