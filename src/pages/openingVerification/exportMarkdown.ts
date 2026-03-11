/**
 * OpeningVerificationPage — Markdown export helper
 * Pure function, no React dependencies.
 */
import { isWriteEnabled } from '@/env';
import type { HealthCheckSummary } from '@/sharepoint/spListHealthCheck';
import { crudIcon, statusIcon } from './constants';
import type { CrudResult, FieldCheckResult, SelectCheckResult } from './types';

export function buildVerificationMarkdown(
  healthResult: HealthCheckSummary | null,
  fieldResults: FieldCheckResult[],
  selectResults: SelectCheckResult[],
  crudResults: CrudResult[],
): string {
  const lines: string[] = [
    `# A班 Day-2 開通確認レポート`,
    `**実行日時**: ${new Date().toLocaleString('ja-JP')}`,
    `**WRITE_ENABLED**: ${isWriteEnabled ? '✅ ON' : '❌ OFF'}`,
    '',
  ];

  if (healthResult) {
    lines.push('## 1. リスト存在確認', '');
    lines.push('| # | List | SP名 | Status | HTTP |');
    lines.push('|---|------|------|--------|------|');
    healthResult.results.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.displayName} | \`${r.listName}\` | ${statusIcon(r.status)} ${r.status} | ${r.httpStatus ?? '—'} |`);
    });
    lines.push('');
  }

  if (fieldResults.length > 0) {
    lines.push('## 2. フィールド差分表', '');
    lines.push('| List | Field (App) | Tenant | Type | Status |');
    lines.push('|------|-------------|--------|------|--------|');
    fieldResults.forEach(r => {
      if (r.status !== 'ok') {
        const statusLabel = r.status === 'missing' ? '❌ missing'
          : r.status === 'type_mismatch' ? `⚠️ type_mismatch (expected: ${r.expectedJsType})`
          : r.status === 'unmapped_required' ? '⚠️ unmapped_required'
          : '⚠️ ' + r.status;
        lines.push(`| ${r.listKey} | \`${r.fieldApp}\` | ${r.fieldTenant} | ${r.tenantType ?? '—'} | ${statusLabel} |`);
      }
    });
    const okCount = fieldResults.filter(r => r.status === 'ok').length;
    lines.push('', `> ✅ ${okCount}/${fieldResults.length} フィールド OK`, '');
  }

  if (selectResults.length > 0) {
    lines.push('## 3. SELECTクエリ検証', '');
    lines.push('| List | 列数 | Status | HTTP | 取得件数 | エラー |');
    lines.push('|------|------|--------|------|----------|--------|');
    selectResults.forEach(r => {
      lines.push(`| \`${r.listKey}\` | ${r.fieldCount} | ${r.status === 'ok' ? '✅' : '❌'} | ${r.httpStatus ?? '—'} | ${r.sampleCount ?? '—'} | ${r.error ?? ''} |`);
    });
    const selOk = selectResults.filter(r => r.status === 'ok').length;
    lines.push('', `> ${selOk === selectResults.length ? '✅' : '⚠️'} ${selOk}/${selectResults.length} SELECT成功`);
    const failedSelects = selectResults.filter(r => r.status === 'fail');
    if (failedSelects.length > 0) {
      lines.push('', '### 3-1. 失敗クエリの$selectフィールド', '');
      failedSelects.forEach(r => {
        lines.push(`**\`${r.listKey}\`** (${r.listName}):`);
        lines.push('```');
        lines.push(r.selectFields);
        lines.push('```');
        if (r.error) lines.push(`> ❌ ${r.error}`);
        lines.push('');
      });
    }
    lines.push('');
  }

  if (crudResults.length > 0) {
    lines.push('## 4. CRUD確認表', '');
    lines.push('| Entity | List | Read | Create | Update |');
    lines.push('|--------|------|------|--------|--------|');
    crudResults.forEach(r => {
      lines.push(`| ${r.entity} | \`${r.listName}\` | ${crudIcon(r.read)} | ${crudIcon(r.create)} | ${crudIcon(r.update)} |`);
    });
    lines.push('');
  }

  const issues: string[] = [];
  if (healthResult) {
    healthResult.results.filter(r => r.status !== 'ok').forEach(r => {
      issues.push(`- **${r.displayName}** (\`${r.listName}\`): ${r.status} (HTTP ${r.httpStatus ?? '?'})`);
    });
  }
  fieldResults.filter(r => r.status !== 'ok').forEach(r => {
    issues.push(`- **${r.listKey}**.\`${r.fieldApp}\`: ${r.status}`);
  });
  selectResults.filter(r => r.status === 'fail').forEach(r => {
    issues.push(`- **SELECT**: \`${r.listKey}\` ${r.error ?? 'failed'}`);
  });
  crudResults.forEach(r => {
    if (r.readError) issues.push(`- **${r.entity}** Read: ${r.readError}`);
    if (r.createError && r.createError !== 'WRITE_DISABLED') issues.push(`- **${r.entity}** Create: ${r.createError}`);
    if (r.updateError) issues.push(`- **${r.entity}** Update: ${r.updateError}`);
  });

  if (issues.length > 0) {
    lines.push('## 5. 未解決課題一覧', '');
    issues.forEach(issue => lines.push(issue));
  } else {
    lines.push('## 5. 未解決課題一覧', '', '> 🎉 未解決課題なし');
  }

  return lines.join('\n');
}
