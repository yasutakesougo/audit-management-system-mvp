/* eslint-disable no-console -- CLI ops script */
/**
 * buildIssueDrafts — Patrol 検知結果から Issue Draft を生成する純関数
 *
 * Phase B-1: 巨大ファイル / any / テスト不足
 * Phase B-2: TODO/FIXME/HACK / Handoff 不足
 *
 * 設計原則:
 *   - 純関数（副作用なし）
 *   - patrol の閾値をそのまま再利用
 *   - 1 問題 = 1 Issue（同種密集は 1 件にまとめ）
 *
 * @see .agents/workflows/nightly.md
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEDGER_PATH = path.join(ROOT, 'docs/nightly-patrol/issue-ledger.json');

/**
 * Ledger: { [fingerprint: string]: { firstSeen: string, lastSeen: string } }
 */
function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveLedger(ledger) {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8');
}

// ─── Thresholds (patrol 本体と同一値) ──────────────────────────────────────

const THRESHOLDS = {
  largeFile: {
    /** 即分割 — 個別 Issue */
    critical: 800,
    /** 監視対象 — まとめ Issue */
    warn: 600,
    /** 件数がこれ以上で Issue 化 */
    countWarn: 3,
    countError: 8,
  },
  any: {
    countWarn: 10,
    countError: 30,
  },
  untestedFeature: {
    countWarn: 2,
    countError: 5,
  },
  todo: {
    countWarn: 20,
    countError: 50,
    /** FIXME/HACK がこの件数以上なら severity を 1 段上げる */
    fixmeEscalate: 5,
  },
  handoff: {
    /** 「No handoff」で Issue 化 */
    missingIssue: true,
    /** handoff ファイルの最終更新から何日経つと stale 扱いか */
    staleDays: 7,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function severity(count, warnThreshold, errorThreshold) {
  if (count >= errorThreshold) return 'critical';
  if (count >= warnThreshold) return 'high';
  return 'medium';
}

/** @reserved Phase B-3: 重複検知のグルーピング用 */
function _groupByDirectory(files) {
  const dirs = {};
  for (const f of files) {
    const parts = f.file.split('/');
    // src/features/xxx or src/pages or src/lib/xxx
    const dir = parts.length >= 3 ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
    if (!dirs[dir]) dirs[dir] = [];
    dirs[dir].push(f);
  }
  return dirs;
}

// ─── Draft Builders ─────────────────────────────────────────────────────────

/**
 * 巨大ファイル → Issue Draft
 *
 * - 800行超: 個別 Issue (critical)
 * - 600行超 × 3件以上: まとめ Issue (high)
 */
function buildLargeFileDrafts(largeFiles) {
  const drafts = [];

  // 800行超 → 個別 Issue
  const criticalFiles = largeFiles.filter((f) => f.lines >= THRESHOLDS.largeFile.critical);
  for (const f of criticalFiles) {
    drafts.push({
      title: `[refactor] ${f.file} (${f.lines}行) を分割`,
      severity: 'critical',
      category: 'large-file',
      summary: `\`${f.file}\` が ${f.lines} 行で、即分割の閾値 (${THRESHOLDS.largeFile.critical}行) を超えています。`,
      rationale: [
        'Thin Orchestrator パターンでは 1 ファイル ≤200行を推奨。',
        '800行超はレビュー困難・テスト困難・変更事故のリスクが急上昇。',
        'nightly patrol で検知。',
      ].join('\n'),
      targetFiles: [f.file],
      proposal: [
        '表示層 (Presentational) と導出ロジック (Hook) を分離',
        '純関数を domain/ 配下へ移動',
        'Orchestrator を ≤200行 に維持',
        '`/refactor` ワークフローで段階的に分割',
      ],
      acceptanceCriteria: [
        `\`${f.file}\` が 400 行未満になること`,
        '既存テストがすべて通ること (`npx vitest run`)',
        '型チェックが通ること (`npx tsc --noEmit`)',
        '振る舞いが既存と一致すること',
      ],
      labels: ['refactor', 'nightly-patrol', 'tech-debt', 'priority-high'],
      fingerprint: `large-file:${f.file}`,
    });
  }

  // 600行超（800行未満）がまとまっている場合 → まとめ Issue
  const warnFiles = largeFiles.filter(
    (f) => f.lines >= THRESHOLDS.largeFile.warn && f.lines < THRESHOLDS.largeFile.critical,
  );
  if (warnFiles.length >= THRESHOLDS.largeFile.countWarn) {
    const sev = severity(warnFiles.length, THRESHOLDS.largeFile.countWarn, THRESHOLDS.largeFile.countError);
    drafts.push({
      title: `[refactor] 巨大ファイル ${warnFiles.length} 件を監視・段階分割`,
      severity: sev,
      category: 'large-file',
      summary: `600行以上のファイルが ${warnFiles.length} 件あり、監視閾値 (${THRESHOLDS.largeFile.countWarn}件) を超えています。`,
      rationale: [
        '個別には即分割レベルではないが、件数が積み上がっている。',
        '次回の変更時に分割を検討するべき候補。',
        'nightly patrol で検知。',
      ].join('\n'),
      targetFiles: warnFiles.map((f) => f.file),
      proposal: [
        '次回変更が入るタイミングで、対象ファイルの hook 抽出を検討',
        '800行を超える前に予防的に分割',
        '`/refactor` ワークフローで段階的に対応',
      ],
      acceptanceCriteria: [
        '各ファイルが次回変更時に 500 行未満を目標にすること',
        '既存テストがすべて通ること',
      ],
      labels: ['refactor', 'nightly-patrol', 'tech-debt', `priority-${sev}`],
      fingerprint: 'large-file:summary',
    });
  }

  return drafts;
}

/**
 * any 使用 → Issue Draft
 *
 * ファイルごとにグルーピングして上位を報告
 */
function buildAnyHitDrafts(anyHits) {
  if (anyHits.length < THRESHOLDS.any.countWarn) return [];

  // ファイルごとに集計
  const byFile = {};
  for (const h of anyHits) {
    if (!byFile[h.file]) byFile[h.file] = [];
    byFile[h.file].push(h);
  }

  const fileEntries = Object.entries(byFile)
    .map(([file, hits]) => ({ file, count: hits.length, sample: hits[0].text }))
    .sort((a, b) => b.count - a.count);

  const sev = severity(anyHits.length, THRESHOLDS.any.countWarn, THRESHOLDS.any.countError);
  const top10 = fileEntries.slice(0, 10);

  return [
    {
      title: `[type-safety] any 使用 ${anyHits.length} 件を型安全化`,
      severity: sev,
      category: 'type-safety',
      summary: `ソースコード内の \`any\` 使用が ${anyHits.length} 件あり、閾値 (${THRESHOLDS.any.countWarn}件) を超えています。`,
      rationale: [
        '`any` はコンパイル時の型チェックを無効化し、本番障害のリスクを高める。',
        '福祉現場OSとして、データ整合性は最重要。型安全は品質の基盤。',
        `${fileEntries.length} ファイルに分散（上位10件を表示）。`,
        'nightly patrol で検知。',
      ].join('\n'),
      targetFiles: top10.map((e) => e.file),
      proposal: [
        '上位10ファイルを `/review` ワークフローで型安全化',
        '`as any` → 適切な型ガード or generics に置き換え',
        '`: any` → Zod schema から推論した型に置き換え',
        'eslint `@typescript-eslint/no-explicit-any` ルールの段階的有効化を検討',
      ],
      acceptanceCriteria: [
        `any 使用が ${Math.max(5, Math.floor(anyHits.length * 0.7))} 件以下になること`,
        '型チェックが通ること (`npx tsc --noEmit`)',
        '既存テストがすべて通ること',
      ],
      labels: ['type-safety', 'nightly-patrol', 'tech-debt', `priority-${sev}`],
      fingerprint: 'type-safety:any-summary',
    },
  ];
}

/**
 * テスト未整備 feature → Issue Draft
 */
function buildUntestedFeatureDrafts(untestedFeatures) {
  if (untestedFeatures.length < THRESHOLDS.untestedFeature.countWarn) return [];

  const sev = severity(
    untestedFeatures.length,
    THRESHOLDS.untestedFeature.countWarn,
    THRESHOLDS.untestedFeature.countError,
  );

  return [
    {
      title: `[test] テスト未整備 ${untestedFeatures.length} feature のテスト追加`,
      severity: sev,
      category: 'test-coverage',
      summary: `テストファイルが 0 件の feature ディレクトリが ${untestedFeatures.length} 個あり、閾値 (${THRESHOLDS.untestedFeature.countWarn}件) を超えています。`,
      rationale: [
        'テストのない feature はリグレッションリスクが高い。',
        'nightly / CI で守れない領域が残る。',
        '`/test-design` で観点を整理してから追加するのが最も効率的。',
        'nightly patrol で検知。',
      ].join('\n'),
      targetFiles: untestedFeatures.map((f) => f.feature),
      proposal: untestedFeatures.map(
        (f) => `\`${f.feature}\` (${f.codeFiles} files) — \`/test-design\` で観点整理 → \`/test\` で追加`,
      ),
      acceptanceCriteria: [
        '各 feature に最低 1 つのテストファイルがあること',
        'テストが CI で通ること',
        'カバレッジが主要パスをカバーしていること',
      ],
      labels: ['testing', 'nightly-patrol', 'tech-debt', `priority-${sev}`],
      fingerprint: 'test:untested-features',
    },
  ];
}

/**
 * Orchestration Health → Issue Draft
 */
function buildOrchestrationDrafts(orchestrationResults) {
  if (!orchestrationResults || orchestrationResults.score >= 95) return [];

  const sev = orchestrationResults.score < 80 ? 'critical' : 'high';
  
  return [
    {
      title: `[${sev}] [orchestration] Business Execution Health regression (${orchestrationResults.score}%)`,
      severity: sev,
      category: 'orchestration-health',
      summary: [
        '## Orchestration Health Regression',
        '',
        `- Overall Score: **${orchestrationResults.score}%**`,
        `- Status: **${orchestrationResults.status}**`,
        `- Open Failures: **${orchestrationResults.openCount || 0}**`,
      ].join('\n'),
      rationale: [
        'ビジネスロジックの実行（Orchestration / Action Engine）で失敗が発生しています。',
        'これらは現場でのデータ登録失敗や不整合に直結するリスクがあります。',
        'nightly patrol / orchestration audit で検知。',
      ].join('\n'),
      targetFiles: ['src/lib/orchestration/'],
      proposal: [
        '1. `TelemetryDashboard` で直近の失敗内容を確認',
        '2. 特に頻発している Action のエラー原因を特定し修正',
        '3. 現場で発生した未解決エラーについて、解消記録（Resolved Audit）を実施',
      ],
      acceptanceCriteria: [
        'Orchestration Health Score が 95% 以上に復帰すること',
        '未解決 (Open) の Failure カウントが 0 になること',
      ],
      labels: ['orchestration', 'nightly-patrol', 'business-health', `priority-${sev}`],
      fingerprint: 'orchestration:health-regression',
    },
  ];
}

// ─── Phase B-2 Draft Builders ───────────────────────────────────────────────

/**
 * TODO/FIXME/HACK → Issue Draft
 *
 * - ファイルごとにグルーピング
 * - FIXME/HACK が多い場合は severity を 1 段上げる
 * - 上位ファイルを報告
 */
function buildTodoHitDrafts(todoHits) {
  if (todoHits.length < THRESHOLDS.todo.countWarn) return [];

  // ファイルごとに集計
  const byFile = {};
  let fixmeCount = 0;
  let hackCount = 0;

  for (const h of todoHits) {
    if (!byFile[h.file]) byFile[h.file] = [];
    byFile[h.file].push(h);
    if (/\bFIXME\b/.test(h.text)) fixmeCount++;
    if (/\bHACK\b/.test(h.text)) hackCount++;
  }

  const fileEntries = Object.entries(byFile)
    .map(([file, hits]) => ({ file, count: hits.length }))
    .sort((a, b) => b.count - a.count);

  let sev = severity(todoHits.length, THRESHOLDS.todo.countWarn, THRESHOLDS.todo.countError);
  // FIXME/HACK が多い場合はエスカレート
  const urgentCount = fixmeCount + hackCount;
  if (urgentCount >= THRESHOLDS.todo.fixmeEscalate && sev === 'medium') {
    sev = 'high';
  }

  const top10 = fileEntries.slice(0, 10);
  const breakdown = [
    `TODO: ${todoHits.length - fixmeCount - hackCount}`,
    `FIXME: ${fixmeCount}`,
    `HACK: ${hackCount}`,
  ].join(', ');

  return [
    {
      title: `[tech-debt] TODO/FIXME/HACK ${todoHits.length} 件を整理`,
      severity: sev,
      category: 'tech-debt',
      summary: `ソースコード内の TODO/FIXME/HACK コメントが ${todoHits.length} 件あり、閾値 (${THRESHOLDS.todo.countWarn}件) を超えています。\n内訳: ${breakdown}`,
      rationale: [
        'TODO/FIXME はコード内に残った「未解決の意思決定」。',
        '特に FIXME/HACK は技術的負債の中でも優先対応が必要。',
        `${fileEntries.length} ファイルに分散（上位10件を表示）。`,
        'nightly patrol で検知。',
      ].join('\n'),
      targetFiles: top10.map((e) => e.file),
      proposal: [
        '各 TODO を以下のいずれかに分類:',
        '  - **即対応**: 次のスプリントで解消（FIXME/HACK 優先）',
        '  - **Issue 化**: 独立した Issue に切り出し、TODO コメントに Issue 番号を付与',
        '  - **削除**: もう不要なら削除',
        '`/review` ワークフローで 1 ファイルずつ整理',
      ],
      acceptanceCriteria: [
        `TODO/FIXME/HACK が ${Math.max(10, Math.floor(todoHits.length * 0.7))} 件以下になること`,
        '残存する TODO には対応 Issue 番号が付記されていること',
        'FIXME/HACK が ${Math.max(2, Math.floor(urgentCount * 0.5))} 件以下になること',
      ],
      labels: ['tech-debt', 'nightly-patrol', `priority-${sev}`],
      fingerprint: 'tech-debt:todo-summary',
    },
  ];
}

/**
 * Handoff 不足 → Issue Draft
 *
 * - handoff ディレクトリが空なら「未開始」
 * - 最終更新が古いなら「滞留」
 *
 * @param {string} lastHandoffInfo - patrol の lastHandoffInfo 文字列
 */
function buildHandoffDraft(lastHandoffInfo) {
  if (!lastHandoffInfo) return [];

  // "No handoff directory found" or "No handoff files found"
  if (lastHandoffInfo.includes('No ')) {
    return [
      {
        title: '[ops] Handoff 運用を開始する',
        severity: 'medium',
        category: 'operations',
        summary: 'Handoff（引き継ぎ文書）が未作成です。セッション終了時の知識引き継ぎが行われていません。',
        rationale: [
          'AI 開発 OS ではセッション終了時に `/handoff` で引き継ぎ文書を作成するルール。',
          '引き継ぎがないと、次セッションの立ち上がりが遅くなり、同じ調査を繰り返すリスクがある。',
          '運用の持続性を確保するための基盤ドキュメント。',
          'nightly patrol で検知。',
        ].join('\n'),
        targetFiles: ['docs/handoff/'],
        proposal: [
          '次回セッション終了時に `/handoff` ワークフローを実行',
          '作成する内容: 今回の作業内容・未完了タスク・次回の推奨作業・注意点',
          '`docs/handoff/YYYY-MM-DD-[topic].md` の命名規約に従う',
        ],
        acceptanceCriteria: [
          '`docs/handoff/` に最低 1 つの引き継ぎ文書があること',
          '文書に「作業内容」「未完了」「次回推奨」が含まれていること',
        ],
        labels: ['operations', 'nightly-patrol', 'priority-medium'],
        fingerprint: 'ops:missing-handoff',
      },
    ];
  }

  // "Last: docs/handoff/2026-03-20-nightly-maintenance.md (3 total)" のパターン
  const dateMatch = lastHandoffInfo.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const lastDate = new Date(dateMatch[1]);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince >= THRESHOLDS.handoff.staleDays) {
      return [
        {
          title: `[ops] Handoff が ${daysSince} 日間更新されていない`,
          severity: daysSince >= 14 ? 'high' : 'medium',
          category: 'operations',
          summary: `最後の Handoff 文書は ${dateMatch[1]} (${daysSince}日前) です。直近の作業セッションの引き継ぎが漏れている可能性があります。`,
          rationale: [
            `最終 Handoff: ${lastHandoffInfo}`,
            `${daysSince} 日間更新なし（閾値: ${THRESHOLDS.handoff.staleDays}日）。`,
            '引き継ぎ文書が古いと、コンテキストロスにより同じ調査の繰り返しが発生する。',
            'nightly patrol で検知。',
          ].join('\n'),
          targetFiles: ['docs/handoff/'],
          proposal: [
            '直近のセッション作業内容を振り返り、引き継ぎ文書を作成',
            '`/handoff` ワークフローを実行',
            '今後はセッション終了時に必ず `/handoff` を実行する運用を徹底',
          ],
          acceptanceCriteria: [
            '今日の日付で新しい Handoff 文書が作成されていること',
            '直近の作業コンテキストが記録されていること',
          ],
          labels: ['operations', 'nightly-patrol', `priority-${daysSince >= 14 ? 'high' : 'medium'}`],
          fingerprint: 'ops:stale-handoff',
        },
      ];
    }
  }

  // Handoff は正常 → Draft なし
  return [];
}

/**
 * 契約ドリフト → Issue Draft
 */
function buildContractDriftDrafts(contractResults) {
  const failed = contractResults.filter((r) => r.status === 'fail');
  if (failed.length === 0) return [];

  return failed.map((r) => ({
    title: `[Contract Drift] ${r.name} の整合性崩壊`,
    severity: r.severity || 'high',
    category: 'api-contract',
    summary: `${r.name} において契約ドリフトが検知されました。\n${r.summary}`,
    rationale: [
      'Core API の契約（インターフェース）が変更されている可能性があります。',
      '契約の不一致は、依存するすべてのモジュールで実行時エラーを引き起こすリスクがあります。',
      'nightly / contract patrol で検知。',
    ].join('\n'),
    targetFiles: [r.targetFile],
    proposal: [
      `1. \`${r.command}\` を実行して詳細を確認`,
      '2. インフラ層 (`src/lib/spClient.ts` 等) の最近の変更を確認',
      '3. 意図的な変更であれば契約テストを更新、そうでなければ実装を修正',
    ],
    acceptanceCriteria: [
      `契約テスト \`${r.targetFile}\` がパスすること`,
      'ビルドと型チェックが正常であること',
    ],
    labels: ['api-contract', 'nightly-patrol', 'priority-high', 'needs-review'],
    fingerprint: r.fingerprint,
  }));
}

/**
 * Index Pressure → Issue Draft
 */
function buildIndexPressureDrafts(indexResults) {
  const targetResults = indexResults.filter((r) =>
    ['action_required', 'critical'].includes(r.severity) || r.status === 'FAIL'
  );

  return targetResults.map((r) => {
    const severity = r.severity === 'critical' || r.status === 'FAIL' ? 'critical' : 'high';
    
    // Consistency check for evidence logs
    let evidenceLog = r.dryRunLog || '';
    if (!evidenceLog && r.remediationResults && r.remediationResults.length > 0) {
      evidenceLog = r.remediationResults.map(res => `[${res.outcome}] ${res.message}`).join('\n');
    }

    const listId = r.listKey || r.list;
    const fieldId = r.fieldName || (r.missingIndexes && r.missingIndexes[0]);

    return {
      title: `[${severity}] [index-pressure] ${listId}.${fieldId} index missing`,
      severity,
      category: 'index-pressure',
      summary: [
        '## Index Pressure Detected',
        '',
        `- List: ${listId}`,
        `- Field: ${r.fieldName || (r.missingIndexes && r.missingIndexes.join(', '))}`,
        `- Severity: ${r.severity || 'FAIL'}`,
        `- Fingerprint: ${r.fingerprint || `index-pressure:${listId}:${fieldId}`}`,
      ].join('\n'),
      rationale: [
        'SharePoint リストのクエリ性能が悪化し、スロットリングやタイムアウトのリスクがあります。',
        '特にフィルタリングやソートに使用されるカラムはインデックス化が必須です。',
        'nightly patrol / index-audit で検知。',
      ].join('\n'),
      targetFiles: [`sharepoint/lists/${listId}`],
      proposal: [
        '## Dry-run remediation',
        '',
        '```bash',
        r.dryRunCommand || `npm run ops:index-remediate -- --list ${listId} --field ${fieldId} --dry-run`,
        '```',
        '',
        evidenceLog ? [
          '## Dry-run Evidence',
          '```text',
          evidenceLog,
          '```'
        ].join('\n') : '',
        '',
        '## Suggested reviewer action',
        '',
        '1. 上記 dry-run を実行して影響を確認',
        '2. インデックスの必要性を確認',
        '3. 手動適用または次の定期メンテナンスで修復を実行',
      ],
      acceptanceCriteria: [
        `\`${listId}\` の \`${fieldId}\` がインデックス化されていること`,
        '対象リストのインデックス数が 20 個（SharePoint上限）を超えていないこと',
      ],
      labels: ['index-pressure', 'nightly-patrol', 'needs-review', 'priority-high'],
      fingerprint: r.fingerprint || `index-pressure:${listId}:${fieldId}`,
    };
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * patrol の検知結果から Issue Draft 配列を生成する
 *
 * @param {object} patrolResults
 * @param {Array<{file: string, lines: number}>} patrolResults.largeFiles
 * @param {Array<{file: string, line: number, text: string}>} patrolResults.anyHits
 * @param {Array<{feature: string, codeFiles: number}>} patrolResults.untestedFeatures
 * @param {Array<{file: string, line: number, text: string}>} patrolResults.todoHits
 * @param {string} patrolResults.lastHandoffInfo
 * @param {Array<object>} patrolResults.contractResults
 * @param {Array<object>} patrolResults.indexResults
 * @returns {Array<object>} Issue Draft 配列（severity 順）
 */
export function buildIssueDrafts(patrolResults) {
  const {
    largeFiles = [],
    anyHits = [],
    untestedFeatures = [],
    todoHits = [],
    lastHandoffInfo = '',
    contractResults = [],
    indexResults = [],
    orchestrationResults = null,
  } = patrolResults;

  const ledger = loadLedger();
  const today = new Date().toISOString().split('T')[0];

  const allDrafts = [
    ...buildLargeFileDrafts(largeFiles),
    ...buildAnyHitDrafts(anyHits),
    ...buildUntestedFeatureDrafts(untestedFeatures),
    ...buildTodoHitDrafts(todoHits),
    ...buildHandoffDraft(lastHandoffInfo),
    ...buildContractDriftDrafts(contractResults),
    ...buildIndexPressureDrafts(indexResults),
    ...buildOrchestrationDrafts(orchestrationResults),
  ];

  const newDrafts = [];
  const dedupedCount = { skipped: 0, updated: 0, new: 0 };

  for (const draft of allDrafts) {
    const fp = draft.fingerprint;
    if (!fp) {
      newDrafts.push(draft);
      continue;
    }

    if (ledger[fp]) {
      ledger[fp].lastSeen = today;
      dedupedCount.skipped++;
      continue;
    }

    ledger[fp] = {
      firstSeen: today,
      lastSeen: today,
      title: draft.title,
    };
    newDrafts.push(draft);
    dedupedCount.new++;
  }

  saveLedger(ledger);

  if (dedupedCount.skipped > 0) {
    console.log(`  📊  Deduplicated: ${dedupedCount.skipped} items already in ledger.`);
  }

  return newDrafts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}

export { THRESHOLDS };
