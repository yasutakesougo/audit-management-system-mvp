/**
 * toAdminSummary — Teams / チャット共有向けフォーマット（福祉事業所向け・3段テンプレ）
 * Extracted from HealthDiagnosisPage.tsx for testability.
 */
import type { HealthReport } from './types';

export function toAdminSummary(report: HealthReport): string {
  const categoryOrder: Record<string, number> = {
    auth: 1,
    connectivity: 2,
    lists: 3,
    schema: 4,
    permissions: 5,
    config: 6,
  };

  const counts = report.counts || { pass: 0, warn: 0, fail: 0 };
  const overall = String(report.overall || "unknown").toLowerCase();
  const generatedAt = report.generatedAt || "";

  const issues = (report.results || [])
    .filter((r) => r.status !== "pass")
    .sort(
      (a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99)
    )
    .slice(0, 5)
    .map((r) => {
      const summary = r.summary || "";
      const action = r.nextActions?.[0]?.label || "";
      let body = action && action !== summary ? `${summary} → ${action}` : summary;
      if (r.status === "fail" && r.detail) {
        body = `${body} (${r.detail})`;
      }
      return `- ${r.status.toUpperCase()} [${r.category}] ${body.slice(0, 150)}`;
    });

  const headerLine =
    overall === "pass"
      ? `判定: ✅ PASS | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`
      : overall === "warn"
        ? `判定: 🟡 WARN | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`
        : `判定: 🔴 FAIL | PASS:${counts.pass} / WARN:${counts.warn} / FAIL:${counts.fail}`;

  if (overall === "pass") {
    return [
      "【Iceberg-PDCA 環境診断】",
      headerLine,
      `生成: ${generatedAt}`,
      "",
      "✅ 環境セットアップ完了",
      "次のステップ：",
      "- 利用者/職員でログイン確認を実施",
      "- 必要に応じて『サマリーをコピー』で管理者に共有",
      "",
      "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (overall === "warn") {
    return [
      "【Iceberg-PDCA 環境診断】",
      headerLine,
      `生成: ${generatedAt}`,
      "",
      "【要対応（上位）】",
      ...(issues.length ? issues : ["- WARN が検出されています"]),
      "",
      "【管理者へ】",
      "- リスト/列/権限を確認し、必要に応じて修正",
      "- リスト作成や列追加が必要な場合は Provision を再実行",
      "- 技術者へ相談する場合は『JSONをコピー』を共有",
      "",
      "【現場へ】",
      "- ログイン後に画面を再読み込みし、再実行で改善確認",
      "",
      "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // FAIL
  return [
    "【Iceberg-PDCA 環境診断】",
    headerLine,
    `生成: ${generatedAt}`,
    "",
    "【要対応（上位）】",
    ...(issues.length ? issues : ["- FAIL が検出されています"]),
    "",
    "【まず管理者がやること】",
    "- SharePoint でリストと必須列の存在を確認",
    "- 権限を付与するか Provision を再実行",
    "- 技術者へ共有：『JSONをコピー』を貼り付け",
    "",
    "【現場へ】",
    "- ログイン後に再実行し、改善状況を確認",
    "",
    "※ Delete が WARN の場合：削除権限を付けない運用でも問題ありません（安全設計）",
  ]
    .filter(Boolean)
    .join("\n");
}
