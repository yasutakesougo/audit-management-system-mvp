# SharePoint 運用レジリエンス・アーキテクチャ (ADR)

## 1. 背後にある課題 (Problem Statement)

SharePoint は、ユーザーがブラウザ上で手軽に列名や型を変更できてしまうという性質上、**「外部ソースとしてのスキーマは常に破壊される可能性がある」** という根本的な課題を抱えています。
これに対し、従来のシステムで見られる「列名不一致による 400 Bad Request」や「原因不明の UI 停止」は、事業所（現場）の支援を止める重大なリスクとなります。

## 2. 設計原則 (Design Principles)

本システムは、以下の 4 原則に基づき **「自己修復する業務 OS」** として設計されています。

### 原則 1：Fail-Open (機能を止めない)
- データが 1 件でも取得できるなら継続稼働させる。
- 致命的な欠損（ID がない、型が全く違う）のみを `FAIL` とし、それ以外（列名が `ID` ではなく `ID0` になっている等）は自動解決して `WARN` で継続する。

### 原則 2：Drift is Normal (ズレは日常)
- 内部名のズレ（ドリフト）は「異常」ではなく「常態」として扱う。
- プログラム側で「期待する名前」と「現場で起きている名前」の差分を吸収するマッピング層（`resolveInternalNamesDetailed`）を常設する。

### 原則 3：可観測性 (Diagnosis for Users)
- エラーコードを隠さず、`/admin/status` にて「なぜ止まったか」「誰が何をすべきか」を運用アクションへ翻訳して表示する。

### 原則 4：Repository Integrity
- Repository 層は UI に例外（Exception）を投げない。
- ドリフトが発生していても、内部で解決（Resolve）してクリーンなドメインオブジェクトを UI に提供する。

## 3. 技術実装の中核

### 🔹 ドリフト自動解決ロジック (`resolveInternalNamesDetailed`)
`src/lib/sp/helpers.ts` に実装。以下の 3 段階で解決を試みる。
1. **完全一致**: 定義通りの内部名。
2. **Fuzzy Matching**: `Id` と `ID` のような Case 違いの吸収。
3. **Suffix 吸収**: SharePoint 側で自動付与される `_x0020_ID` や `FullName0` を、ドリフト定義（`CANDIDATES`）に基づきマッピング。

### 🔹 ドリフト候補定義 (`DRIFT_CANDIDATES`)
各ドメインの フィールド定義（`src/sharepoint/fields/`）に、考えられるズレの候補を配列として記述する。
```typescript
// 例: 日次活動記録の定義
export const DAILY_ACTIVITY_RECORDS_CANDIDATES = {
  UserID: ["UserID", "User_x0020_ID"], // ズレてもここから探す
  // ...
};
```

### 🔹 診断マトリックス (`checks.ts`)
| 状態 | 判定基準 | 運用アクション |
| :--- | :--- | :--- |
| **PASS** | 定義通りの列名、書き込み権限あり | なし |
| **WARN** | ドリフト解決済み / Blocked Provisioning | **管理者**: 現場の SP 構成を確認 |
| **FAIL** | 必須列（Essential）が未定義 / 権限なし | **即時対応**: 本部による物理構成復旧 |

## 4. 運用契約とアンチパターン

### ✅ 推奨される拡張 (Expansion Rule)
1. 新規リスト追加時は `provisioningFields`（作成用）と `essentialFields`（必須用）を分ける。
2. ドリフトしそうな列は `CANDIDATES` レジストリに登録する。
3. `vitest` にて「列名がズレた状態での Repository 取得」テストを追加する。

### ❌ 避けるべきアンチパターン
- **列名のハードコード**: `item['Title']` 等の直書き。必ず Repository 層で解決済みのデータを使う。
- **例外の UI 伝播**: `try-catch` で何もせず UI に 400 を投げる。
- **WARN の FAIL 視**: 運用継続可能なドリフトを FAIL にして、現場の機能を止める。

## 5. 今後の進化 (Future Roadmap)

1. **Drift Event Log**: 夜間巡回（Nightly Patrol）で検知したズレを `ExceptionCenter` に永続化し、運用の「MTTR（平均復旧時間）」を計測する。
2. **Auto-Healing UI**: 管理画面から「ドリフトを修正して物理列名を元に戻すボタン」の実装。

---
**最終更新日**: 2026-04-03
**承認ステータス**: SRE チーム完全承認済 (GO)
