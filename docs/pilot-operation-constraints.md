# 限定運用（Pilot）前提条件

> **作成日**: 2026-03-10
> **対象**: イソカツシステム MVP の限定 pilot 導入

---

## 1. pilot 運用の前提

| 項目 | 条件 |
|------|------|
| 利用端末 | **単一端末**（ブラウザ 1 台）を想定 |
| 操作者 | **1〜2 名の管理者・現場担当者** |
| 利用場所 | 施設内 LAN + インターネット接続環境 |
| 認証 | Azure AD（MSAL）による実テナント認証 |
| データストア | SharePoint Online（コアリスト） + localStorage（一部機能） |

---

## 2. 使える機能 / 使えない機能

### ✅ pilot で使用可能

| 機能 | 根拠 |
|------|------|
| **出席管理** (Attendance) | SP リスト `Daily_Attendance` 等が存在すれば動作 |
| **日次記録** (Daily Records) | `/dailysupport` → 各記録画面。認証済みユーザーなら利用可能 |
| **Dashboard（運営状況）** | `/dashboard` — 管理者向け KPI 表示 |
| **TodayOps** | `/today` — `VITE_FEATURE_TODAY_OPS=1` 設定が必要 |
| **ユーザー管理** (Users) | `/users` — admin ロール必要 |
| **職員管理** (Staff) | `/staff` — admin ロール必要 |
| **管理者ツール** | Navigation Diagnostics, Data Integrity, Mode Switch |
| **議事録** (Meeting Minutes) | CRUD 動作確認済み |

### ⚠️ 条件付きで使用可能

| 機能 | 条件 | リスク |
|------|------|--------|
| **Handoff（申し送り）** | `VITE_HANDOFF_STORAGE=local`（既定）| **ブラウザ localStorage に保存**されるため、端末を変えるとデータが見えない。単一端末 pilot なら許容可能 |
| **看護観察** (Nurse) | `NurseObservations` リストが SP に存在すること | ロールガード未設定。認証済みユーザー全員がアクセス可能 |
| **スケジュール** (Schedules) | `VITE_FEATURE_SCHEDULES=1` + SP `Schedules` リスト存在 | 現在フラグ OFF のため非表示。リスト存在チェックが `ProtectedRoute` に組み込み済み |

### ❌ pilot では使用しない（未整備）

| 機能 | 理由 |
|------|------|
| **コンプライアンス報告** | プレースホルダー表示のみ（「近日公開」） |
| **請求** (Billing) | ページがスタブ状態（287 bytes） |
| **氷山モデル PDCA** | フラグ `VITE_FEATURE_ICEBERG_PDCA` OFF（既定）。Firestore 依存 |
| **CSV インポート** | 管理者ツールだが pilot 初期には不要 |

---

## 3. Handoff の制約（重要）

| 項目 | 現状 |
|------|------|
| ストレージ既定値 | `VITE_HANDOFF_STORAGE=local`（localStorage） |
| SP への切り替え | `VITE_HANDOFF_STORAGE=sharepoint` に変更 + SP `Handoff` リスト作成が必要 |
| SP リスト名 | `spListRegistry.ts` → `envOr('VITE_SP_HANDOFF_LIST_TITLE', 'Handoff')` |

**pilot での判断基準:**

```
単一端末 + 単一担当者  → localStorage で運用可能
複数端末 or 複数担当者 → SharePoint バックエンド必須（リスト作成が必要）
```

> [!IMPORTANT]
> localStorage モードでは、ブラウザのキャッシュクリアやシークレットモードでデータが消失します。
> pilot 中に Handoff データの永続性が必要な場合は、早期に SharePoint バックエンドを検討してください。

---

## 4. SharePoint リストの必要状況

### 必須（pilot 開始前に確認必要）

| リスト名 | Registry key | 用途 |
|----------|-------------|------|
| `Users_Master` | `users_master` | 利用者マスタ |
| `Staff_Master` | `staff_master` | 職員マスタ |
| `OrgMaster` | `org_master` | 組織マスタ |
| `Daily_Attendance` | `daily_attendance` | 日次出欠 |
| `SupportRecord_Daily` | `support_record_daily` | 日次支援記録 |
| `DailyActivityRecords` | `daily_activity_records` | 日次活動記録 |

### 後回し可（pilot スコープ外）

| リスト名 | 理由 |
|----------|------|
| `Handoff` | localStorage モードなら不要 |
| `Schedules` | フラグ OFF の場合不要 |
| `NurseObservations` | Nurse 機能を使わない場合不要 |
| `MeetingSessions` / `MeetingSteps` | 会議機能を使わない場合不要 |
| `IcebergPdca` | フラグ OFF のため不要 |

---

## 5. RBAC の pilot 時挙動

| 環境変数 | 設定状況 | 影響 |
|----------|---------|------|
| `VITE_AAD_ADMIN_GROUP_ID` | **必須** | 未設定 → 全ユーザーが viewer に fail-close → admin ページ使用不可 |
| `VITE_AAD_RECEPTION_GROUP_ID` | 推奨 | 未設定 → reception ロール判定不可（admin or viewer のみ） |
| `VITE_SKIP_LOGIN` | `0` 必須 | `1` だと全ロールチェックがバイパスされる |

---

## 6. 確認チェックリスト

pilot 開始前に以下を確認してください:

- [ ] SharePoint テナントに必須 6 リストが存在する
- [ ] `.env` に `VITE_AAD_ADMIN_GROUP_ID` が設定されている
- [ ] `.env` に `VITE_MSAL_CLIENT_ID` / `VITE_MSAL_TENANT_ID` が本番値
- [ ] `.env` に `VITE_SP_RESOURCE` / `VITE_SP_SITE_RELATIVE` が本番値
- [ ] `VITE_FEATURE_TODAY_OPS=1` が設定されている（frontline 導線に必要）
- [ ] `VITE_SKIP_LOGIN=0` である（`1` は禁止）
- [ ] `VITE_SKIP_SHAREPOINT=0` である（`1` は `guardProdMisconfig` で即停止）
- [ ] `VITE_WRITE_ENABLED=1` である（書き込み許可）
- [ ] 管理者アカウントでログインし、`/users` にアクセスできることを確認
- [ ] 一般職員アカウントでログインし、`/today` に到達することを確認
- [ ] Handoff が localStorage モードで動作することを確認（単一端末前提）

---

*関連: [feature-catalog.md](feature-catalog.md) / [env-reference.md](env-reference.md) / [go-live-playbook.md](go-live-playbook.md)*
