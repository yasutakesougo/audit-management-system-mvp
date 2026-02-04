const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');
const redirectsPath = path.join(distDir, '_redirects');

// Ensure dist exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write _redirects file (Netlify SPA fallback)
const redirectsContent = '/*    /index.html   200\n';
fs.writeFileSync(redirectsPath, redirectsContent, 'utf8');

console.log(`[netlify] wrote ${redirectsPath}`);
