/**
 * Opening Verification Page — render helpers (icons, styles, markdown export)
 */
import { isWriteEnabled } from '@/env';
import type { HealthCheckSummary, ListCheckStatus } from '@/sharepoint/spListHealthCheck';
import type { CrudResult, FieldCheckResult, SelectCheckResult } from './types';

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------
export const statusIcon = (s: ListCheckStatus): string => {
  switch (s) {
    case 'ok': return '✅';
    case 'not_found': return '❌';
    case 'forbidden': return '🔒';
    case 'error': return '⚠️';
  }
};

export const crudIcon = (s: string): string => {
  switch (s) {
    case 'ok': return '✅';
    case 'fail': return '❌';
    case 'skip': return '⏭';
    case 'pending': return '⏳';
    default: return '—';
  }
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
export const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

export const btnStyle = (color: string, running: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 'bold',
  background: running ? '#ccc' : color,
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: running ? 'not-allowed' : 'pointer',
  marginRight: '8px',
});

export const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ddd',
  background: '#f5f5f5',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
};

export const tdStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #ddd',
  fontSize: '13px',
};

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------
export function exportMarkdown(
  healthResult: HealthCheckSummary | null,
  fieldResults: FieldCheckResult[],
  selectResults: SelectCheckResult[],
  crudResults: CrudResult[],
  log: (msg: string) => void,
) {
  const lines: string[] = [
    `# A班 Day-2 開通確認レポート`,
    `**実行日時**: ${new Date().toLocaleString('ja-JP')}`,
    `**WRITE_ENABLED**: ${isWriteEnabled ? '✅ ON' : '❌ OFF'}`,
    '',
  ];

  // Section 1: List existence
  if (healthResult) {
    lines.push('## 1. リスト存在確認', '');
    lines.push('| # | List | SP名 | Status | HTTP |');
    lines.push('|---|------|------|--------|------|');
    healthResult.results.forEach((r, i) => {
      lines.push(`| ${i+1} | ${r.displayName} | \`${r.listName}\` | ${statusIcon(r.status)} ${r.status} | ${r.httpStatus ?? '—'} |`);
    });
    lines.push('');
  }

  // Section 2: Field check
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
    lines.push('', `> ✅ ${okCount}/${fieldResults.length} フィールド OK`);
    lines.push('');
  }

  // Section 3: SELECT verification
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

  // Section 4: CRUD
  if (crudResults.length > 0) {
    lines.push('## 4. CRUD確認表', '');
    lines.push('| Entity | List | Read | Create | Update |');
    lines.push('|--------|------|------|--------|--------|');
    crudResults.forEach(r => {
      lines.push(`| ${r.entity} | \`${r.listName}\` | ${crudIcon(r.read)} | ${crudIcon(r.create)} | ${crudIcon(r.update)} |`);
    });
    lines.push('');
  }

  // Section 5: Issues
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

  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opening-verification-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
  log('📥 マークダウンレポートをダウンロードしました');
}
