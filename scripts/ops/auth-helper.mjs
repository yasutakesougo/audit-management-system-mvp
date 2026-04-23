import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const TOKEN_FILE = join(REPO_ROOT, '.token.local');

/**
 * Fetches a fresh access token using M365 CLI.
 */
export function refreshM365Token() {
  try {
    console.log('🔄 Refreshing SharePoint token via M365 CLI...');
    // Extract tenant from VITE_SP_SITE_URL or hardcode
    const siteUrl = process.env.VITE_SP_SITE_URL || 'https://isogokatudouhome.sharepoint.com';
    const tenant = new URL(siteUrl).origin;
    
    const token = execSync(`m365 util accesstoken get --resource ${tenant} --output text`, { encoding: 'utf-8' }).trim();
    if (token) {
      writeFileSync(TOKEN_FILE, token);
      return token;
    }
  } catch (e) {
    console.warn('⚠️  Failed to refresh token via M365 CLI. Ensure you are logged in: "m365 login"');
  }
  return null;
}

/**
 * Gets a valid token, either from cache or by refreshing.
 */
export function getAccessToken() {
  let token = '';
  try {
    token = readFileSync(TOKEN_FILE, 'utf-8').trim();
  } catch (_e) {
    token = process.env.VITE_SP_TOKEN || '';
  }

  if (!token) {
    token = refreshM365Token() || '';
  }
  
  return token;
}
