# Users CRUD — RFC / 実装仕様

> **注記：** このドキュメントは [docs/dev/crud-template.md](../dev/crud-template.md) の Schedules CRUD パターンに基づいています。  
> DB スキーマは伝統的な RDB を想定しており、SharePoint Online リスト実装の場合は [src/infra/sharepoint/fields.ts](../../src/infra/sharepoint/fields.ts) の FIELD_MAP に合わせて調整してください。

---

## 概要

- Users（ユーザー管理）の CRUD 機能設計。管理画面または内部ツール向けに、ユーザーの作成・一覧・更新・削除・バルク操作を提供する。
- 目標は安全で拡張可能な設計（認可、バリデーション、監査ログを重視）。

---

## 目的と成功基準

- 管理者がユーザーを作成・編集・削除できる
- 権限に応じた操作制御（Role-based access control）
- 主要ユースケースに対する E2E テストが存在する
- マイグレーションやロールバック手順が明記される

---

## ユーザーストーリー

- 管理者はユーザー一覧を見てユーザーを編集できる
- 管理者は新しいユーザーを追加できる（メール、名前、役割）
- 管理者はユーザーを無効化（soft delete）できる
- サービスはユーザー変更の監査ログを保持する

---

## API（例）

### GET /api/users

- クエリ: `?page=&limit=&q=&role=`
- レスポンス: `[{ id, email, name, role, is_active, created_at, updated_at }]`

### GET /api/users/:id

- レスポンス: `{ id, email, name, role, is_active, created_at, updated_at }`

### POST /api/users

- Body: `{ email: string, name?: string, role: string, password?: string, is_active?: boolean }`
- レスポンス: `{ id, email, name, role, is_active, created_at, updated_at }`

### PATCH /api/users/:id

- Body: `{ name?, role?, is_active? }`
- レスポンス: `{ id, email, name, role, is_active, created_at, updated_at }`

### DELETE /api/users/:id

- 実装: **soft delete**（`is_active = false`）を推奨。物理削除が必要な場合は別 API を設ける。

---

## DB スキーマ（案）

### テーブル: users

```
id              uuid (PK)
email           varchar, unique, not null
name            varchar
role            enum('admin','auditor','user', ...)
is_active       boolean default true
password_hash   varchar | null（必要なら）
created_at      timestamp
updated_at      timestamp
deleted_at      timestamp | null（soft delete 用）
```

### インデックス

- `email` (unique)
- `role` (必要に応じて)

---

## マイグレーション

- 追加するカラム・制約を含む migration ファイルを作成
- ロールバック手順（down migration）を提供
- データ移行が必要な場合、無害な順序で段階的に実行する

---

## 認可・認証

- API は JWT / セッション等既存方式を使用
- 権限: 管理者のみユーザー作成・削除を許可、編集はロールに応じて制限
- フロントは表示制御だけでなく、**サーバ側で必ず検証**する

---

## バリデーション

- **email**: RFC 準拠チェック + 一意性（DB で保証）
- **role**: 許可された値のみ
- **入力**: サニタイズし、XSS を防止

---

## UI フロー（管理画面）

- **一覧**: ページネーション、検索、フィルタ（role / is_active）
- **新規作成**: フォーム（email, name, role, initial password?）
- **編集**: 一部フィールドは制限（email の更新は慎重に）
- **削除**: 確認ダイアログ、soft delete（復元可能）
- **バルク操作**: 複数ユーザーを選択して有効化/無効化/削除

---

## 監査ログ

- だれがいつどの項目を変更したかを記録（user_id, action, target_id, diff, timestamp）
- **重要操作**（削除、ロール変更）は監査ログ必須

---

## テスト

- **ユニットテスト**: バリデーション・サービス層
- **統合テスト**: API エンドポイント（認可含む）
- **E2E**: 主要 UI フロー（一覧、新規、編集、削除）
- **受入条件**: 全てのテストが CI で安定して通過すること

---

## ロールアウト計画

- feature flag で段階リリース（オンデマンドで有効化）
- DB migration はメンテナンス窓口を明示
- ステージでのスモークを必須化

---

## 性能・運用

- **一覧**: ページネーション必須（大規模ユーザを想定）
- **バックエンド**: N+1 に注意（クエリ最適化）
- **ログ**: 保持ポリシーを決める

---

## 受入基準（最低限）

- 管理者で一覧の閲覧・作成・編集・削除が可能
- 主要なバリデーションが UI/バックエンドで実施されている
- CI の自動テストが追加されている（ユニット + API 統合）
- ドキュメント（README/docs）に操作手順が追加されている

---

## タスク分割（例）

1. **DB migration + モデル定義**
2. **API エンドポイント実装（CRUD）**
3. **サービス層のユニット実装**（バリデーション・権限チェック）
4. **フロント**: 一覧ページ + 新規/編集フォーム + 削除ダイアログ
5. **テスト**（ユニット・統合・E2E）
6. **ドキュメント作成**（README/docs）
7. **リリース**（feature flag → 本番）

---

## 備考

- 必要なら追加のユースケース（SSO, パスワードリセット, 招待フロー）を別 RFC として作成してください。
