# ロール別受入確認チェックリスト

## 目的

Iceberg-PDCA / 支援計画シート / Admin Status が、ロール別に想定通り表示・保存・再読込・監査記録されることを確認する。

## 前提

- Admin Status: PASS 272 / WARN 0 / FAIL 0
- Nightly Runtime Patrol: SUCCESS
- DriftEventsLog_v2: Threshold-Safe 読み取り済み
- optional drift / silent drift: allow 扱い

## 判定記号

| 記号 | 意味 |
|---|---|
| OK | 想定通り |
| NG | 不具合あり |
| N/A | 対象外 |
| HOLD | 要確認・保留 |

## チェックマトリクス

| ロール | 機能 | 表示 | 保存 | 再読込 | 監査ログ | 結果 | 備考 |
|---|---|---:|---:|---:|---:|---|---|
| 管理者 | Admin Status | OK | N/A | OK | - | OK | PASS 272 / FAIL 0 / 旧 ZOMBIE 抑制済 |
| 管理者 | Iceberg |  |  |  |  |  | 新規作成・更新・再読込 |
| 管理者 | PDCA |  |  |  |  |  | Iceberg 連携含む |
| 管理者 | 支援計画シート |  |  |  |  |  | 連携データ反映含む |
| 職員 | Admin Status |  | N/A | N/A | N/A |  | 原則、表示されない想定 |
| 職員 | Iceberg |  |  |  |  |  | 権限内で作成・更新 |
| 職員 | PDCA |  |  |  |  |  | 権限内で作成・更新 |
| 職員 | 支援計画シート |  |  |  |  |  | 権限内で閲覧・更新 |
| 限定ロール | Admin Status |  | N/A | N/A | N/A |  | 非表示またはアクセス不可 |
| 限定ロール | Iceberg |  |  |  |  |  | 閲覧範囲・操作制限 |
| 限定ロール | PDCA |  |  |  |  |  | 閲覧範囲・操作制限 |
| 限定ロール | 支援計画シート |  |  |  |  |  | 閲覧範囲・操作制限 |

## 初回確認手順

### 1. 管理者 × Admin Status

- `/admin/status` を開く
- PASS 272 / WARN 0 / FAIL 0 を確認
- サマリーコピーができることを確認
- Nightly Runtime Patrol の最新 summary が参照できることを確認
- 古い Action Required が最新状態として表示されていないことを確認

#### 1-a. 事前判定（ログ・診断結果ベース）

| 観点 | 事前判定 | 備考 |
|---|---|---|
| 表示 | OK | Admin Status は PASS 272 / WARN 0 / FAIL 0 の実績あり |
| 再読込 | OK相当 | Nightly 復旧後も PASS 272 維持 |
| サマリーコピー | HOLD | ブラウザ上の実操作確認が必要 |
| Nightly summary | OK | Nightly Runtime Patrol が SUCCESS、runtime-summary 生成済み |
| 古い decision の混入なし | HOLD | 4/23 の旧 Action Required 表示が残っていないか画面確認が必要 |

#### 1-b. ブラウザ確認項目（ユーザー実施）

```text
1. Admin Status が PASS 272 / WARN 0 / FAIL 0 で表示されるか
2. 画面再読込後も同じ表示か
3. 「サマリーをコピー」が成功するか
4. Nightly Runtime Patrol / runtime-summary の最新状態が見えるか
5. 2026-04-23 の古い Action Required が現在の警告として残っていないか
```

#### 1-c. 正式判定（ブラウザ確認後に転記）

| 観点 | 結果 | 備考 |
|---|---|---|
| 表示 | OK | PASS 272 / WARN 0 / FAIL 0 を確認 |
| 再読込 | OK | ページリロード後も表示が維持されることを確認 |
| サマリーコピー | OK | ボタン押下時のフィードバックを確認 |
| Nightly summary | HOLD | 「実行結果がまだありません（初回実行待ち）」と表示 |
| 古い decision の混入なし | NG | 2026-04-23 の ZOMBIE 項目が画面上部に表示されたまま |

## 不具合記録テンプレート

| 項目 | 内容 |
|---|---|
| 発生日 |  |
| ロール |  |
| 機能 |  |
| 操作 |  |
| 期待結果 |  |
| 実際の結果 |  |
| スクリーンショット |  |
| コンソールエラー |  |
| 関連ログ |  |
| 判定 | NG / HOLD |
| 修正状況 |  |

## 個別確認詳細

### 1. 管理者 × Admin Status
- **結果**: PASS (2026-04-27 修正適用済み)
- **修正内容**: 最新診断が PASS または判定が古い（STALE）場合に ZOMBIE 項目を抑制するロジックを `HealthPage.tsx` に実装。

### 2. 管理者 × Iceberg
- **操作手順**:
  1. `/analysis/iceberg` を開く
  2. 既存の分析が表示されるか、または「新規作成」が可能か確認
  3. 内容を入力し「保存」を実行
  4. ページをリロードし、入力内容が保持されているか確認
  5. ブラウザコンソールまたは `DriftEventsLog_v2` に不要なエラーが出ていないか確認

#### 2-a. 確認記録

| 観点 | 結果 | 備考 |
|---|---|---|
| 表示 | OK | 画面遷移、コンポーネント、利用者選択、取込ボタンを確認 |
| 保存 | HOLD | SharePoint 429 スロットリング中につき、解除待ち |
| 再読込 | HOLD | 保存不可のため未確認 |
| 監査ログ | HOLD | スロットリング解消後に、保存操作によるノイズ発生がないか確認が必要 |

### 関連リスク: Users 画面のスロットリングについて

`/users` 画面で `Failed to fetch` が発生する事象を確認済み。
これは認証やスキーマ不備ではなく、利用者一覧取得後の詳細情報の並列取得負荷による SharePoint 429 スロットリングが原因。

- **Issue**: `fix(users): reduce SharePoint throttling by limiting profile detail fetches` を起票済み
- **受入確認への影響**: Iceberg 等の他機能の保存・再読込確認は、スロットリング解除を待ってから実施。
- **根本対策**: 別タスク（並列数制御・Lazy Load）にて対応予定。
