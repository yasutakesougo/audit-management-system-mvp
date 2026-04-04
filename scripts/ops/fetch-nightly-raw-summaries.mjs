/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly raw summary fetcher
 *
 * 目的:
 * - CI で /admin/status と ExceptionCenter の生JSONを取得し、
 *   exporter の入力ファイルとして保存する
 *
 * 入力:
 * - ADMIN_STATUS_RAW_URL / EXCEPTION_CENTER_RAW_URL
 * - NIGHTLY_RAW_BEARER_TOKEN (任意)
 * - NIGHTLY_RAW_EXTRA_HEADERS_JSON (任意; JSON object)
 *
 * 出力:
 * - docs/nightly-patrol/admin-status-raw-<date>.json
 * - docs/nightly-patrol/exception-center-raw-<date>.json
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'docs', 'nightly-patrol');

function parseArgs(argv) {
  const out = {
    date: null,
    adminUrl: '',
    exceptionUrl: '',
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      out.date = argv[i + 1] || null;
      i += 1;
    } else if (arg === '--admin-url') {
      out.adminUrl = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--exception-url') {
      out.exceptionUrl = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--strict') {
      out.strict = true;
    }
  }
  return out;
}

function isDateStamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseExtraHeaders(raw) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && key.trim()) {
        out[key.trim()] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function setGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${key}=${value}\n`, 'utf8');
}

async function fetchJson(url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
        data: null,
      };
    }
    try {
      return {
        ok: true,
        status: res.status,
        error: null,
        data: JSON.parse(text),
      };
    } catch (error) {
      return {
        ok: false,
        status: res.status,
        error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        data: null,
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = isDateStamp(args.date) ? args.date : utcTodayStamp();
  const adminUrl = args.adminUrl || process.env.ADMIN_STATUS_RAW_URL || '';
  const exceptionUrl = args.exceptionUrl || process.env.EXCEPTION_CENTER_RAW_URL || '';
  const strict = args.strict || process.env.NIGHTLY_RAW_FETCH_STRICT === 'true';
  const timeoutMs = toFiniteNumber(process.env.NIGHTLY_RAW_TIMEOUT_MS) ?? 15000;
  const token = process.env.NIGHTLY_RAW_BEARER_TOKEN || '';
  const extraHeaders = parseExtraHeaders(process.env.NIGHTLY_RAW_EXTRA_HEADERS_JSON || '');

  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const adminOutPath = path.join(REPORT_DIR, `admin-status-raw-${date}.json`);
  const exceptionOutPath = path.join(REPORT_DIR, `exception-center-raw-${date}.json`);

  const errors = [];

  console.log('📥 Fetch nightly raw summaries');

  if (adminUrl) {
    const result = await fetchJson(adminUrl, headers, timeoutMs);
    if (result.ok) {
      fs.writeFileSync(adminOutPath, `${JSON.stringify(result.data, null, 2)}\n`, 'utf8');
      console.log(`   ✅ admin-status: ${path.relative(ROOT, adminOutPath)}`);
      setGithubOutput('admin_raw_path', adminOutPath);
    } else {
      console.warn(`   ⚠️ admin-status fetch failed: ${result.error}`);
      errors.push(`admin-status: ${result.error}`);
      setGithubOutput('admin_raw_path', '');
    }
  } else {
    console.log('   ℹ️ admin-status URL not configured');
    setGithubOutput('admin_raw_path', '');
  }

  if (exceptionUrl) {
    const result = await fetchJson(exceptionUrl, headers, timeoutMs);
    if (result.ok) {
      fs.writeFileSync(exceptionOutPath, `${JSON.stringify(result.data, null, 2)}\n`, 'utf8');
      console.log(`   ✅ exception-center: ${path.relative(ROOT, exceptionOutPath)}`);
      setGithubOutput('exception_raw_path', exceptionOutPath);
    } else {
      console.warn(`   ⚠️ exception-center fetch failed: ${result.error}`);
      errors.push(`exception-center: ${result.error}`);
      setGithubOutput('exception_raw_path', '');
    }
  } else {
    console.log('   ℹ️ exception-center URL not configured');
    setGithubOutput('exception_raw_path', '');
  }

  setGithubOutput('raw_fetch_error_count', String(errors.length));

  if (strict && errors.length > 0) {
    console.error(`❌ raw fetch failed (${errors.length}): ${errors.join(' | ')}`);
    process.exit(1);
  }
}

await main();
