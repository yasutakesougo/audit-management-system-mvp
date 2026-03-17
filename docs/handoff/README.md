# Handoff ドキュメント

このディレクトリには、各セッション終了時の引き継ぎ文書を保存します。

## 命名規則

| 種類 | パターン | 例 |
|------|---------|-----|
| セッション引き継ぎ | `YYYY-MM-DD_[テーマ].md` | `2026-03-17_sharepoint-audit.md` |
| スプリント引き継ぎ | `sprint/sprint-[N]_handoff.md` | `sprint/sprint-12_handoff.md` |

## 運用ルール

1. 1日の作業終了時に `/handoff` を実行
2. 出力をこのディレクトリにコミット
3. 翌日の開始時に前日の handoff を読んでから作業を始める
4. 3日以上間が空く場合は `/scan L2` も追加実行する

詳細は [ai-dev-os-rules.md](../operations/ai-dev-os-rules.md) を参照。
