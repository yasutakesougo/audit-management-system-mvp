/**
 * URL normalization utilities for env/auth (Issue #344)
 */

/**
 * Normalize http:// to https:// for production URLs
 * - localhost/127.0.0.1 は変換しない（CI/E2E/ローカルHTTP保護）
 * 
 * @param url - Input URL string
 * @returns Normalized URL
 */
export function normalizeHttpsUrl(url: string): string {
  if (!url) return url;
  
  // localhost/127.0.0.1 は変換しない（CI/E2E 保護）
  if (url.includes('://localhost') || url.includes('://127.0.0.1')) {
    return url;
  }
  
  // http:// → https:// に置換
  return url.replace(/^http:\/\//, 'https://');
}
