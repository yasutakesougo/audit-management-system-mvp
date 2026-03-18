import type { TelemetrySummary } from '../computeTelemetrySummary';

export type IndexAuditReportOptions = {
  minScoreThreshold?: number;
  topN?: number;
  includeReasons?: boolean;
};

export type IndexAuditReportItem = {
  listName: string;
  field: string;
  score: number;
  count: number;
  reasons: string[];
};

export type IndexAuditReportModel = {
  generatedAt: string;
  totalLists: number;
  totalCandidates: number;
  thresholdFilter: number;
  items: IndexAuditReportItem[];
};

export function buildIndexAuditReportModel(
  summary: TelemetrySummary,
  options?: IndexAuditReportOptions
): IndexAuditReportModel {
  const minScore = options?.minScoreThreshold ?? 4;
  const topN = options?.topN ?? 10;

  // Filter and map existing topIndexCandidates from summary
  const items: IndexAuditReportItem[] = summary.topIndexCandidates
    .filter((candidate) => candidate.score >= minScore)
    .slice(0, topN)
    .map((candidate) => ({
      listName: candidate.listName,
      field: candidate.field,
      score: candidate.score,
      count: candidate.count,
      reasons: [...candidate.reasons], // copy
    }));

  const uniqueLists = new Set(items.map((i) => i.listName));

  return {
    generatedAt: new Date().toISOString(),
    totalLists: uniqueLists.size,
    totalCandidates: items.length,
    thresholdFilter: minScore,
    items,
  };
}

export function renderIndexAuditMarkdown(
  model: IndexAuditReportModel
): string {
  let md = `# SharePoint Index Audit Report

Generated: ${model.generatedAt}

## Summary
- Lists with candidates: ${model.totalLists}
- Total candidates: ${model.totalCandidates}
- Threshold: score >= ${model.thresholdFilter}

## Candidates
※これらは高頻度かつ slow/warning を伴うクエリから算出したインデックス候補です。実際の設定有無については SharePoint リスト設定を確認してください。
`;

  if (model.items.length === 0) {
    md += `\n現在、推奨されるインデックス候補はありません。\n`;
    return md;
  }

  // Group items by ListName for cleaner representation
  const grouped: Record<string, IndexAuditReportItem[]> = {};
  for (const item of model.items) {
    if (!grouped[item.listName]) {
      grouped[item.listName] = [];
    }
    grouped[item.listName].push(item);
  }

  for (const [listName, candidates] of Object.entries(grouped)) {
    md += `\n### ${listName}\n`;
    for (const c of candidates) {
      md += `- ${c.field} — score ${c.score}, count ${c.count}, reasons: ${c.reasons.join(', ')}\n`;
    }
  }

  return md;
}
