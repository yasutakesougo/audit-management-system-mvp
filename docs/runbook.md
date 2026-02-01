# 運用 Runbook (初動対応ガイド)

本書は SharePoint + アプリ連携運用時の **よくある失敗モード** と **初動切り分け手順** を 1 ページに集約したものです。

関連ガイド:
- [認証トラブルシューティング (MSAL / リダイレクト)](runbook/auth-troubleshooting.md)

---
## 1. インシデント分類クイックテーブル
| 症状 | HTTP / 兆候 | 初動カテゴリ | 優先度 | 代表ログ例 |
|------|-------------|--------------|--------|-------------|
| 認証失敗 | 401 / 403 | auth | High | acquireTokenSilent error / insufficient privileges |
| スロットリング | 429 | throttle | Medium | retry after X ms |
| 一時的障害 | 503 / 504 | transient | Medium | gateway timeout / service unavailable |
| サーバーエラー | 500-502 | server | Medium | internal error |
| バリデーション | 400 | bad_request | Low | invalid field name |
| リスト/URL不正 | 404 | not_found | Low | list not found |

---
## 2. 初動判断フロー (概要)
```mermaid
decision
flowchart TD
  A[障害検知] --> B{HTTP ステータス?}
  B -->|401/403| C[auth 再取得 & パーミッション確認]
  B -->|429| D[Retry-After or バックオフ]
  B -->|503/504| E[指数バックオフ再送]
  B -->|400| F[スキーマ/ペイロード検証]
  B -->|404| G[URL/リスト存在確認]
  B -->|>=500| H[一時障害 or MS 側 issue]
  D --> I{規定回数失敗?}
  E --> I
  H --> I
  I -->|Yes| J[手動エスカレーション]
  I -->|No| K[自動再試行継続]
```

---
## 3. Retry / Backoff ポリシー
| ケース | アクション |
|--------|-----------|
| 429 + Retry-After | 指定秒数 + jitter (再送) |
| 429 (ヘッダなし) | 指数バックオフ (base=400ms, cap=5s) |
| 503/504 | 同上 (最大試行回数超で失敗) |
| 500 (単発) | 原則 1 回リトライ (過剰連打回避) |
| 401 | アクセストークン再取得 (1 回) → 失敗なら auth incident |
| 403 | パーミッション (Sites.FullControl.All 等) / 管理者同意確認 |

---
## 4. 再送判断ツリー
1. 失敗アイテム分類 (auth / throttle / server / bad_request / not_found / other)
2. auth -> 資格再取得後再送
3. throttle / transient -> バックオフ後再送
4. bad_request -> スキーマ / フィールド名 / payload 修正 (再送前にコード修正必須)
5. not_found -> サイトURL / リストタイトル / internalName 誤り確認
6. other -> 詳細ログ / bodySnippet 解析し分類更新

---
## 5. 監査バッチメトリクス活用
`window.__AUDIT_BATCH_METRICS__` (DEV):
```jsonc
{
  "total": 42,
  "success": 40,
  "duplicates": 5,
  "failed": 2,
  "categories": { "throttle": 1, "server": 1 },
  "durationMs": 420,
  "parserFallbackCount": 0
}
```
- duplicates: 409 (一意制約) → 再送不要
- failed: 再送候補 (重複と成功を除外)
- parserFallbackCount > 0: SharePoint 応答フォーマット変動を検知 (ログ収集推奨)

---
## 6. Backfill entry_hash 運用
| モード | 指標 | 意味 |
|--------|------|------|
| WHATIF | Needed | 補完対象件数 (見積) |
| APPLY | Updated | 実際に更新した件数 |
| BOTH | Duration | パフォーマンス計測 (秒) |

差異例: Needed=120 / Updated=118 → 中断や権限制限可能性。再実行 or ログ調査。

---
## 7. エスカレーション条件
| 条件 | 目安 |
|------|------|
| 5+ 分継続する 429 | テナント負荷 or 制限ポリシー変更確認 |
| parserFallbackCount が急増 | SharePoint レスポンス仕様変化懸念 |
| 401/403 が全操作で頻発 | アプリ登録 / 同意設定 破損 |
| 500 系が 30 分以上継続 | MS 側サービス障害 (Service Health 参照) |

---
## 8. ログ収集テンプレ
```
Incident Time (UTC):
Endpoint: <URL>
Status Codes Timeline: [429, 429, 503, ...]
Retry Strategy: base=400ms, attempts=4
Last parserFallbackCount: <n>
Token Acquire Count / Refresh Count: <a>/<r>
Correlation IDs (if any): [...]
```

---
## 9. よくある修正例
| 症状 | 修正 |
|------|------|
| 400: Invalid field name | internalName タイポ / スキーマ不整合修正 |
| 409: Duplicate entry_hash | 正常 (成功扱い) - ローカル消去条件影響なし |
| 404: list not found | サイト / リストタイトル再確認、大文字小文字確認 |
| 401 after refresh | API permission 不足 / 管理者同意未付与 |

---
## 10. 改善バックログ候補
- parserFallbackCount 発生時の自動アラート (console.warn → optional hook)
- Backfill の 差分再試行 / 部分失敗再集計
- Webhook / Teams 連携による障害速報投稿

---
## 11. SLO / 運用品質
| 指標 | 目標 | 測定方法 |
|------|------|----------|
| 成功率 (監査バッチ) | >= 99.5% / 30日 | `success+duplicates / total` (夜間集計) |
| MTTR (重大: auth/throttle連続) | <= 30分 | Incident タイムスタンプ差 |
| 解析不能レスポンス率 | < 0.5% | parserFallbackCount / バッチ回数 |

Weekly Drill (5分演習):
1. テスト環境で 429 強制 (Mock)
2. Runbook 手順のみ参照し回復 (再送成功)
3. 所要時間 / 手順欠落を記録し Runbook 更新


最終更新: 2025-09-23
