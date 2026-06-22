# Audit Management System MVP Permission / Navigation / Access Boundary Matrix Report

調査実施日: 2026年6月19日
対象コミット: `c406bc5f7eb37ed21abd1b6ba72cffc52744ff72`

## 1. 調査目的
本調査の目的は、Audit Management System MVP におけるルーティング（Routing）、サイドバー表示（Navigation）、およびアクセス権限（Access Boundary）の関係性をマッピングし、想定されたセキュリティと操作境界が正しく設計・保護されているかを検証することです。
通常モードとキオスク（Kiosk）モードの表示切り替え、管理者/現場職員/閲覧者（viewer）の役割に応じた画面表示の制御、`ProtectedRoute` や `RequireAudience` ガードによる直アクセス防止、および機能公開制御（Feature Flag）の整合性を棚卸しし、潜在的なアクセス漏れリスクを洗い出します。

---

## 2. ルーティング・ナビゲーション・権限境界の全体像
当システムにおける画面遷移とアクセス制限は、主に以下の3つのレイヤーで制御されています。

1. **Routing Layer (ルーティング層)**: `router.tsx` を起点に、各ドメイン別ルート定義（`*Routes.tsx`）がページコンポーネントを lazy-load し配置します。
2. **Access Guard Layer (アクセスガード層)**:
   - `<ProtectedRoute>`: Microsoft Entra ID (MSAL) による認証、SharePointアクセストークンの準備状況、および機能固有の Feature Flag の有効化チェックを行います。
   - `<RequireAudience>`: ユーザーのロール階層とページに必要な最小ロールの整合性をチェックし、403画面をレンダリングします。
   - `<AdminSurfaceRouteGuard>`: 管理者向けの重要画面（Admin Surface）に対して、ロールチェック（デフォルトで `reception` 以上）を追加適用します。
3. **Navigation Visibility Layer (サイドバー/ナビゲーション表示層)**:
   - `createNavItems`: Feature Flag とユーザーロールに応じてサイドバーの表示項目リストを動的に構築します。
   - `buildVisibleNavItems` / `isNavVisible`: ユーザーが選択した非表示グループ設定、Lite Nav設定、およびキオスクモードの状態に基づいて表示リストを最終フィルタリングします。
     - **4本柱の救済措置 (FORCED_PILLARS)**: `/records/monthly`, `/support-plan-guide`, `/planning-sheet-list`, `/assessment` は、表示設定や Lite Nav の階層化にかかわらず、常にサイドバーに表示されます。

---

## 3. Role / Mode / Feature Flag の整理

システム内の制御変数（ロール、レイアウトモード、機能フラグ）の仕様と定義を整理します。

### 1. ロール階層（Role）
Active Directory (Microsoft Entra ID) のグループIDに基づいて `useUserAuthz` が判定します。
* **`admin` (Level 3)**: 管理者グループ（`VITE_ADMIN_GROUP_ID`）に属するユーザー。全機能の利用と管理が可能。
* **`reception` (Level 2)**: 受付グループ（`VITE_RECEPTION_GROUP_ID`）に属するユーザー。マスタ管理や職員勤怠入力が可能。
* **`viewer` (Level 1 / field staff)**: 上記グループに属さない一般現場スタッフ。支援記録や申し送り、計画書の作成・閲覧が可能。

### 2. レイアウトモード（Mode）
* **通常モード (`normal`)**: AppShellHeader と AppShellSidebar を備えた、一般的なデスクトップ/モバイル画面。
* **キオスクモード (`kiosk`)**: 共有端末向けの全画面・フォーカス表示モード。サイドバーが非表示になり、下部フッターアクションバーとキオスク用ナビゲーションが有効化されます。

### 3. Feature Flags (機能フラグ)
`useFeatureFlags` を通じて、環境変数（`VITE_FEATURE_*`）および `localStorage` (`feature:*`) の値から動的に状態が読み込まれます。
* `schedules`: スケジュール予約機能の有効化
* `todayOps`: 今日の業務（Today Hub）の有効化
* `staffAttendance`: 職員勤怠入力の有効化
* `complianceForm`: 制度遵守・コンプラ報告機能の有効化
* `todayLiteNavV2`: 表示階層化（Lite Nav）の有効化

---

## 4. 主要ルート別アクセスマトリクス

主要な画面におけるナビゲーション表示（Sidebar）、直URLアクセス（Direct Access）、およびアクセス制御の実態です。

| Route | 画面 | Sidebar表示 | Direct Access | Role/Mode | Guard / Gate | 判定 | 備考 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/dashboard` | ダッシュボード | あり | 可 | staff/admin | `RequireAudience("viewer")` | **A** | 通常モードの業務分析ダッシュボード |
| `/today` | 今日の業務 (Today Hub) | あり | 可 | staff/admin | `ProtectedRoute(flag="todayOps")` <br/> `withHubAudienceGuard("today")` | **A** | `todayOps` フラグ必須。現場の司令塔 |
| `/assessment` | アセスメント | あり | 可 | staff/admin | `RequireAudience("viewer")` | **A/B** | 4本柱常駐対象。アセスメント画面 |
| `/kiosk` | Kiosk Home | 分離 | 可 | kiosk/demo | `ProtectedRoute` (no flag) | **A** | `/kiosk` URLまたは設定にてキオスク化 |
| `/kiosk/toilet` | Kiosk トイレ記録 | Kiosk内のみ | 可 | kiosk/staff | `ProtectedRoute` (no flag) | **A** | 共有端末でのトイレ排泄記録用 |
| `/checklist` | 自己点検シート | あり | 可 | admin | `RequireAudience("admin")` | **B** | プラットフォームハブから遷移可 |
| `/audit` | 監査ログ表示 | あり | 可 | admin | `RequireAudience("admin")` | **B** | 管理者による操作追跡 |
| `/admin/exception-center` | 例外センター (管理者) | あり | 可 | admin | `RequireAudience("admin")` | **B** | 管理者専用の例外検知画面 |
| `/exceptions` | 例外対応センター | なし | 可 | reception/admin | `RequireAudience("viewer")` <br/> `AdminSurfaceRouteGuard("reception")` | **B/C** | viewerは強制リダイレクトされる |
| `/isp-editor` | 支援計画前回比較 | あり | 可 | admin | `RequireAudience("admin")` | **B** | 管理者（サビ管）専用のISPエディタ |
| `/schedules/week` | 週間予定表 | あり | 可 | staff/admin | `SchedulesGate` <br/> `ProtectedRoute("schedules")` | **A** | `schedules` フラグに依存してガード |
| `/admin/integrated-resource-calendar` | 統合リソース予約 | あり | 可 | admin | `SchedulesGate` <br/> `ProtectedRoute("schedules")` <br/> `RequireAudience("admin")` | **A** | リソース枠（車両・部屋）の統合調整 |

### 判定基準の定義
* **A (確実な保護)**: ルートガード、ナビゲーション表示、ロール階層が完全に連動し、E2Eおよびユニットテストでもカバーされている。
* **B (通常保護)**: ロールガードは効いているが、直URLアクセス時のエラー挙動が整理途上。
* **C (表示/アクセス制御混同の懸念)**: ナビゲーション上の表示非表示でアクセスを防いでおり、直アクセスへのガードが薄い。
* **D/E (要改善/要再調査)**: 未使用ルートが残っている、またはロールガードの不一致によるタイムアウトや意図しないバイパスのリスクがある。

---

## 5. Sidebar / Mobile Drawer / Direct URL の挙動差異
* **Sidebar (デスクトップ)**: 画面幅が `md` (768px) 以上のデスクトップ環境で表示。`navCollapsed` によるミニ表示（64px）に対応し、ホバーでツールチップが表示されます。
* **Mobile Drawer (モバイル)**: モバイル環境でメニューアイコン（三本線）を押した際にスライドイン表示。項目を選択すると Drawer は自動で閉じられます（`handleMobileNavigate` によるクリーンアップ）。
* **Direct URL アクセス**: ナビゲーションからリンクが非表示にされていても、URL をアドレスバーに直接入力してアクセスすると、ルーター経由で画面が読み込まれます。
  - **重要**: ナビゲーションの非表示化（Lite Nav や hiddenNavItems 設定）はアクセス制限ではないため、セキュリティ境界は必ず `ProtectedRoute` および `RequireAudience` のガードによって担保される必要があります。

---

## 6. 通常モードと Kiosk モードの境界
キオスクモードは、共有端末の誤操作や他画面への意図しない遷移を防ぐため、UI・レイアウトレベルで厳格に分離されています。

* **切り替えトリガー**:
  - URLパラメータ `?kiosk=1` または `?kiosk=true` の検出時に、`useAppShellState` 内の effect が `layoutMode: 'kiosk'` に設定を更新。
  - URLパスが `/kiosk` または `/kiosk/` で始まる場合も自動的にキオスク表示が有効化。
* **UI表示制限**:
  - サイドバー (`AppShellSidebar`) とヘッダー (`AppShellHeader`) が完全に非表示になります（`isFullscreenMode` が true）。
  - 代わりに下部に 240px 以上のパディングが確保され、キオスク専用の下部アクションバー（`FooterQuickActions` / `KioskNavigation`）が配置されます。
* **脱出手段**:
  - 通常モードへの復帰は、右下に配置される `KioskExitFab`（退出ボタン）を明示的に操作した場合のみに限定されます。

---

## 7. Admin / Exception / Checklist 系画面の保護状態

管理者および監査に関連する画面は、一般スタッフのアクセスを防止するために二重でガードされています。

1. **Checklist & Audit**:
   - `/checklist` および `/audit` は、`RequireAudience requiredRole="admin"` でラッピングされており、`viewer` または `reception` のユーザーがアクセスしようとすると「設定エラー」または「権限不足」の 403 画面が強制表示されます。
2. **Exception Center**:
   - 管理者向けパス `/admin/exception-center` は `RequireAudience("admin")` で保護されています。
   - スタッフ向けパス `/exceptions` は、`RequireAudience("viewer")` に加え、`AdminSurfaceRouteGuard` が適用されています。`AdminSurfaceRouteGuard` に `minimumRole` が指定されていないため、デフォルトの `reception` 以上の権限がないユーザーは強制的に `/today` にリダイレクトされます（403 画面を出さずに別画面へ逃がす仕様）。

---

## 8. リスクと改善候補

調査を通じて見つかった、潜在的なリスクと改善に向けた提案事項です。

1. **`/exceptions` と `/admin/exception-center` の二重定義 (リスク中)**
   * **現状**: 類似した機能（例外対応）に対して、異なるガード設定（片方は 403画面、もう片方は強制リダイレクト）が適用されており、アクセス境界のポリシーに揺らぎが生じています。
   * **改善候補**: スタッフ向けの例外表示と管理者向けの詳細表示の境界を明確にし、ガード構成を統一します。
2. **`RequireAudience` の E2E バイパス設定 (リスク小)**
   * **現状**: `RequireAudience.tsx` 内で `VITE_E2E_ENFORCE_AUDIENCE` 環境変数が `1` でない限り、E2Eテスト環境（`allowBypass`）においてすべての権限チェックがスキップされます。
   * **改善候補**: CI上の E2E テストにおいて、一部のテストケースで `VITE_E2E_ENFORCE_AUDIENCE=1` を適用し、権限不足時の 403 画面への遷移やリダイレクトが正常に機能しているかを定期検証するテストを追加します。

---

## 9. 次に切るべき小PR候補

本調査に基づき、安全にアクセス境界の整合性を向上させるための小規模 PR 提案です。

1. **`refactor: unify-exception-center-route-guards`**
   * **目的**: `/exceptions` と `/admin/exception-center` のアクセスガード構造とリダイレクトポリシーを整理・統一。
2. **`test: add-e2e-role-based-access-validation`**
   * **目的**: `VITE_E2E_ENFORCE_AUDIENCE=1` を用いて、`admin` 専用画面に `reception` や `viewer` で直接アクセスした際に、期待通り 403 画面やリダイレクトが作動することを検証する E2E テストケースの追加。
3. **`docs: refine-navigation-config-comments`**
   * **目的**: `navigationConfig.ts` 内でのナビゲーション非表示制御がアクセス制御（Security Guard）ではないことを明記するコメントの拡充。
