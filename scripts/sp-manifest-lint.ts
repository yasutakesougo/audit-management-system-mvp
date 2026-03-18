/**
 * sp-manifest-lint.ts
 *
 * SP リスト管理の整合性を CI で検証するスクリプト。
 * SP への接続なしで、コードと manifest.json の一貫性のみをチェックする。
 *
 * 検査内容:
 *   [A] ListKeys の全メンバーが LIST_CONFIG に登録されているか
 *   [B] lists.manifest.json の全エントリが ListKeys に存在するか
 *   [C] ListKeys の全メンバーが manifest に含まれているか（または _excluded に記録されているか）
 *
 * 使い方:
 *   npm run sp:audit
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ListKeys, LIST_CONFIG } from '../src/sharepoint/fields/listRegistry.js';

// ── manifest 読み込み ─────────────────────────────────────────────────────────
const MANIFEST_PATH = resolve(process.cwd(), 'scripts/sp-preprod/lists.manifest.json');

interface ManifestList {
  listKey: string;
  listTitle: string;
}

interface Manifest {
  lists: ManifestList[];
  _excluded?: { lists: string[] };
}

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
} catch {
  console.error(`[sp:audit] ERROR: manifest not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

// ── データ収集 ─────────────────────────────────────────────────────────────────

// ListKeys の全 value（SP リスト名）
const allListKeyValues = new Set(Object.values(ListKeys));

// manifest に含まれるリストタイトル
const manifestTitles = new Set(manifest.lists.map(l => l.listTitle));

// manifest の _excluded に記録されているリスト
const excludedTitles = new Set(manifest._excluded?.lists ?? []);

// ── 検査 ──────────────────────────────────────────────────────────────────────

const errors:   string[] = [];
const warnings: string[] = [];

// LIST_CONFIG は Record<ListKeys, {title}> なので型レベルで保証済み。
// ただし enum の value 数と LIST_CONFIG の key 数を比較して漏れを検出する。
const listKeysCount   = allListKeyValues.size;
const listConfigCount = Object.keys(LIST_CONFIG).length;

if (listKeysCount !== listConfigCount) {
  errors.push(
    `[A] ListKeys has ${listKeysCount} members but LIST_CONFIG has ${listConfigCount} entries. ` +
    `Missing: check for enum members without LIST_CONFIG mapping.`
  );
} else {
  // eslint-disable-next-line no-console
  console.log(`[A] OK  ListKeys (${listKeysCount}) === LIST_CONFIG entries (${listConfigCount})`);
}

// [B] manifest のリストタイトルが ListKeys に存在するか
for (const listDef of manifest.lists) {
  const title = listDef.listTitle;
  if (!allListKeyValues.has(title as ListKeys)) {
    errors.push(`[B] manifest contains "${title}" but this is NOT in ListKeys. Remove or add to ListKeys.`);
  }
}

const bOkCount = manifest.lists.filter(l => allListKeyValues.has(l.listTitle as ListKeys)).length;
if (errors.filter(e => e.startsWith('[B]')).length === 0) {
  // eslint-disable-next-line no-console
  console.log(`[B] OK  All ${bOkCount} manifest entries exist in ListKeys`);
}

// [C] ListKeys 全メンバーが manifest か _excluded に記録されているか
for (const title of allListKeyValues) {
  if (!manifestTitles.has(title) && !excludedTitles.has(title)) {
    warnings.push(
      `[C] WARN "${title}" is in ListKeys but neither in manifest.lists nor _excluded. ` +
      `Add to manifest or document in _excluded.`
    );
  }
}

const cOkCount = [...allListKeyValues].filter(t => manifestTitles.has(t) || excludedTitles.has(t)).length;
if (warnings.filter(w => w.startsWith('[C]')).length === 0) {
  // eslint-disable-next-line no-console
  console.log(`[C] OK  All ${cOkCount} ListKeys members are accounted for in manifest or _excluded`);
}

// ── 結果出力 ──────────────────────────────────────────────────────────────────

/* eslint-disable no-console */
const isIssueFormat = process.argv.includes('--issue-format');

if (warnings.length > 0) {
  console.warn('\n===== WARNINGS =====');
  warnings.forEach(w => console.warn(' ', w));
}

if (errors.length > 0) {
  console.error('\n===== ERRORS =====');
  errors.forEach(e => console.error(' ', e));

  if (isIssueFormat) {
    // GitHub Issue 用フォーマット（コピペして gh issue create に使える）
    const issueTitle = `[sp:audit] SP manifest 整合エラー ${errors.length}件 — ${new Date().toISOString().slice(0, 10)}`;
    const issueBody = [
      '## 概要',
      '',
      '`npm run sp:audit` で SP manifest の整合エラーが検出されました。',
      '対応が必要です。',
      '',
      '## エラー詳細',
      '',
      errors.map(e => `- ${e}`).join('\n'),
      '',
      ...(warnings.length > 0 ? [
        '## 警告',
        '',
        warnings.map(w => `- ${w}`).join('\n'),
        '',
      ] : []),
      '## 対処方針',
      '',
      '優先順位: **Mismatch/Unique > Missing/List > Missing/Field > Mismatch/Index**',
      '',
      '詳細は [monthly-sp-structure-audit.md](docs/runbook/monthly-sp-structure-audit.md) を参照。',
      '',
      '## 関連ファイル',
      '',
      '- `src/sharepoint/fields/listRegistry.ts` — ListKeys / LIST_CONFIG',
      '- `scripts/sp-preprod/lists.manifest.json` — manifest',
    ].join('\n');

    console.error('\n===== ISSUE TEMPLATE =====');
    console.error(`TITLE: ${issueTitle}`);
    console.error('---');
    console.error(issueBody);
    console.error('===========================');
  }

  console.error(`\nsp:audit FAILED (${errors.length} error(s), ${warnings.length} warning(s))`);
  process.exit(1);
} else {
  console.log('\n===== sp:audit PASSED =====');
  if (warnings.length > 0) {
    console.log(`  ${warnings.length} warning(s) — review above`);
  }
  process.exit(0);
}
