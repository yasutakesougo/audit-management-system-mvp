#!/usr/bin/env node
/*
 * Preflight environment & connectivity check.
 * Usage: node scripts/preflight.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = process.cwd();
const envPath = path.join(root, '.env');

function readEnvFile(p) {
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function parseEnv(src) {
  const out = {};
  for (const line of src.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

function fail(msg) {
  console.error('\n[PREVIEW:FAIL]\n' + msg + '\n');
  process.exitCode = 1;
}

function warn(msg) {
  console.warn('[WARN]', msg);
}

(async () => {
  console.log('== Preflight Check ==');
  const raw = readEnvFile(envPath);
  if (!raw) {
    fail('.env not found at project root');
    return;
  }
  const env = parseEnv(raw);
  const required = ['VITE_SP_RESOURCE', 'VITE_SP_SITE_RELATIVE'];
  let missing = required.filter(k => !env[k]);
  if (missing.length) fail('Missing required keys: ' + missing.join(', '));

  const placeholders = ['<yourtenant>', '<SiteName>', '__FILL_ME__'];
  for (const k of required) {
    const val = env[k] || '';
    if (placeholders.some(p => val.includes(p))) {
      fail(`Key ${k} still contains placeholder: ${val}`);
    }
  }

  const resource = (env.VITE_SP_RESOURCE || '').replace(/\/$/, '');
  if (!/^https:\/\/.+\.sharepoint\.com$/i.test(resource)) {
    fail('VITE_SP_RESOURCE format invalid: ' + resource);
  }
  const siteRel = (env.VITE_SP_SITE_RELATIVE || '').replace(/\/$/, '');
  if (!siteRel.startsWith('/')) warn('VITE_SP_SITE_RELATIVE should start with /. Will continue.');

  const apiUrl = `${resource}${siteRel.startsWith('/') ? siteRel : '/' + siteRel}/_api/web?$select=Title`; // minimal
  console.log('Testing connectivity:', apiUrl);

  // Fire a lightweight unauthenticated request (will likely 401). We only check DNS/host reachability.
  const status = await new Promise(resolve => {
    const req = https.request(apiUrl, { method: 'GET' }, res => {
      resolve(res.statusCode || 0);
      res.resume();
    });
    req.on('error', err => {
      warn('Connectivity error: ' + err.message);
      resolve(0);
    });
    req.end();
  });
  if (status === 0) warn('Could not reach host (network/DNS check failed).');
  else console.log('Reachability status:', status, '(401/403 expected without auth)');

  if (process.exitCode) {
    console.log('Preflight finished with failures.');
  } else {
    console.log('Preflight OK.');
  }
})();
