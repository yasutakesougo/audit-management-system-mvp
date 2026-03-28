import { FeatureMapEntry, Layer } from './types';

export function renderMarkdown(entries: FeatureMapEntry[]): string {
  const now = new Date().toISOString();
  
  const lines: string[] = [
    '# System Map v2 — Support Operations OS',
    '',
    '> **Architecture:** SharePoint 中心の業務 OS。`spFetch` + `Repository DI` が本流。',
    `> **Generated:** ${now}`,
    '> **Source of truth:** `src/features/`, `scripts/system-map/metadata.ts`',
    '',
    '## 0. アーキテクチャとシステムレイヤー',
    '',
    '```mermaid',
    'graph TD',
    '    subgraph "Decision Layer (意思決定)"',
    '        A["🔵 Assessment"]',
    '        PS["📋 Planning Sheet"]',
    '        SPG["📝 Support Plan Guide"]',
    '        IBD["🧊 IBD / 氷山モデル"]',
    '    end',
    '    subgraph "Execution Layer (実行)"',
    '        T["⚡ Today Ops"]',
    '        D["📖 Daily"]',
    '        H["🔀 Handoff"]',
    '        N["💉 Nurse"]',
    '    end',
    '    subgraph "Operations Layer (運用・配置)"',
    '        SCH["📅 Schedules"]',
    '        TR["🚐 Transport"]',
    '        RES["🏠 Resources"]',
    '    end',
    '    subgraph "Governance Layer (統制・監査)"',
    '        AU["🔍 Audit"]',
    '        CC["✅ Compliance"]',
    '        REG["📜 Regulatory"]',
    '        SAF["🛡️ Safety"]',
    '    end',
    '    subgraph "Platform Layer (基盤)"',
    '        U["👤 Users / Staff / Org"]',
    '        AUTH["🔐 Auth / MSAL"]',
    '        INF["📡 SP Infra / Telemetry"]',
    '    end',
    '    subgraph "Output Layer (出力・請求)"',
    '        BILL["💰 Billing"]',
    '        KOK["📄 国保連CSV"]',
    '        FORM["📋 Official Forms"]',
    '    end',
    '',
    '    A -->|"Bridge 1"| PS',
    '    PS -->|"Bridge 2"| D',
    '    D -->|"Bridge 3 (Monitoring)"| PS',
    '    T --> D',
    '    T --> H',
    '    SCH --> T',
    '    D --> AU',
    '    D --> BILL',
    '```',
    '',
    '## 1. Feature Module Registry',
    ''
  ];

  const layers: Layer[] = ['Decision', 'Execution', 'Operations', 'Governance', 'Platform', 'Output', 'Unknown'];
  
  for (const layer of layers) {
    const layerEntries = entries.filter(e => e.layer === layer);
    if (layerEntries.length === 0) continue;

    // Build the table header
    lines.push(`### ${layer} Layer`);
    lines.push('');
    lines.push('| Module | Route | Maturity | DataSource | Prod | Files | Bridges |');
    lines.push('|:---|:---|:---:|:---|:---:|:---:|:---|');

    // Sort by feature name for determinism
    layerEntries.sort((a, b) => a.feature.localeCompare(b.feature));

    for (const e of layerEntries) {
      const routesStr = e.routes.length > 0 ? e.routes.map(r => `\`${r.path}\``).join('<br>') : '—';
      const storageStr = e.storage.length > 0 ? e.storage.map(s => {
        if (s.kind === 'sharepoint') {
           const keys = s.listKeys && s.listKeys.length > 0 ? `SP(${s.listKeys.length} keys)` : 'SP';
           return `**${keys}**`;
        }
        return s.kind;
      }).join(', ') : '—';
      
      const prodStr = e.prod === true ? '✅' : e.prod === 'partial' ? '🔶' : '—';
      const maturityStr = e.reviewRequired ? `⚠️ ${e.maturity}` : e.maturity;
      const bridgesStr = e.bridges.length > 0 ? e.bridges.map(b => b.name).join('<br>') : '—';

      lines.push(`| \`${e.feature}\` | ${routesStr} | **${maturityStr}** | ${storageStr} | ${prodStr} | ${e.filesCount} | ${bridgesStr} |`);
    }
    lines.push('');
  }

  // Warnings
  const warnings = entries.filter(e => e.reviewRequired);
  if (warnings.length > 0) {
    lines.push('## ⚠️ 要レビュー (Unclassified Features)');
    lines.push('');
    lines.push('| Feature | Files | Storage |');
    lines.push('|:---|:---:|:---|');
    for (const w of warnings) {
      const storageStr = w.storage.map(s => s.kind).join(', ');
      lines.push(`| \`${w.feature}\` | ${w.filesCount} | ${storageStr} |`);
    }
    lines.push('');
    lines.push('> 追加するには `scripts/system-map/metadata.ts` を編集してください。');
  }

  return lines.join('\n');
}
