# キオスク運用範囲棚卸しレポート

作成日: 2026-07-19  
調査基点: `f3427620d9138b166b5bce672336c06bc00465b2`  
文書状態: 運用確認用Draft

## 1. 調査基点

- 対象: `kiosk`運用に関するルート到達、保存基盤、共通依存、CI/E2E、オープンPR。
- 方針:
  - 実利用とコード上の到達可能性を分離する。
  - 根拠がない判定は行わず、未確定事項を明記する。
- 制約: read-only調査を根拠とし、コード変更、workflow実行、PR操作、本番操作は調査範囲に含めない。

---

## 2. キオスク実運用ルート

### 2-1. 経営・運用判断表

| ルート | 実利用確認 | 業務目的 | 保存先（要確認含む） | 続行・凍結・廃止候補 | 確定条件 | 運用確認者 |
|---|---|---|---|---|---|---|
| `/kiosk` | 実利用確認済み | キオスク起点画面（運用入口） | 共通基盤（本番Repository未確定） | 続行確定 | 本番Repository、正本、訂正先の確定 | 現場管理責任者 |
| `/kiosk/toilet` | 実利用確認済み | トイレ記録の閲覧・保存 | `toiletRepository`（localStorage/SharePoint分岐） | 続行確定 | 本番Repositoryの正本確定 | 現場管理責任者 |
| `/kiosk/users` | 実利用確認済み | 利用者選択 | execution/attendance系（要確定） | 続行確定 | 本番Repositoryの正本確定 | 現場管理責任者 |
| `/kiosk/users/:userId/procedures` | 実利用確認済み | 支援手順一覧（欠席含む） | execution系（要確定） | 続行確定 | 本番Repositoryの正本確定 | 現場管理責任者 |
| `/kiosk/users/:userId/procedures/:slotKey` | 実利用確認済み | 支援記録の新規作成・参照・訂正 | execution系（要確定） | 続行確定 | 本番Repository、正本、訂正先の確定 | 現場管理責任者 |
| `/daily/attendance` | 利用実績未確認 | 通所・退所導線 | 要確認 | 要運用確認（U） | 利用実績、保存先、戻り先の確認 | 業務責任者 |
| `/schedules/day` | 利用実績未確認 | 当日予定表示導線 | 要確認 | 要運用確認（U） | 利用実績、保存先、再現条件の確認 | 業務責任者 |
| `/abc-record` | 利用実績未確認 | ABC関連導線 | 要確認 | 要運用確認（U） | 同一アプリ内または外部連携の境界、認証境界、保存先、戻り先の確認 | 現場管理責任者・情報システム担当 |

`/abc-record`は、コード上はキオスクから到達可能である。

同一アプリ内ルートか外部連携かは未確定であり、認証境界、保存先、戻り先を確認する。

取消・削除については現行契約を確認できていないため、本レポートでは断定しない。

### 2-2. 到達可能性

| ルート | コード上の到達可能性 | キオスク起点経路 |
|---|---|---|
| `/kiosk` | 到達可能 | 直接アクセス |
| `/kiosk/toilet` | 到達可能 | `/kiosk` |
| `/kiosk/users` | 到達可能 | `/kiosk` |
| `/kiosk/users/:userId/procedures` | 到達可能 | `/kiosk/users` |
| `/kiosk/users/:userId/procedures/:slotKey` | 到達可能 | `/kiosk/users/:userId/procedures` |
| `/daily/attendance` | 到達可能 | `/kiosk` |
| `/schedules/day` | 到達可能 | `/kiosk` |
| `/abc-record` | 到達可能 | `/kiosk/users/:userId/procedures/:slotKey` |

---

## 3. キオスク共通依存

### 3-1. 依存分類

#### キオスク専用

- `kiosk`ルート定義とkiosk画面群
- kiosk検知とレイアウト連携（`useKioskDetection`、`AppShell`関連）

#### キオスクと非キオスク共通

- 認証とセッション（`ProtectedRoute`）
- 利用者情報系（`useUsersQuery`、`useUser`など）
- execution/attendance系Repositoryと各種基盤provider
- リダイレクトと設定系（`redirects`など）

#### 非キオスク専用の可能性が高い領域

- Billing
- Analysis
- Scheduleの登録・編集・週次・月次・管理機能
- Exception Center
- PDF・Excel・帳票基盤

`/schedules/day`はキオスクから到達可能であり、利用実績を確認するまで非キオスク専用とは確定しない。

### 3-2. 重要観点

- `SpInitBridge`などの初期化分岐により、kiosk起点で振る舞いが異なる。
- `/kiosk-users`、`/kiosk-procedures`という旧表記は残存するが、古い定数、診断、リダイレクト、外部ブックマークのいずれに使われるかは未確定である。
- 旧表記は、実利用がないと確認できるまで削除対象にしない。
- 本番Repositoryの正本が未確定な範囲では、依存基盤を削除対象にしない。

---

## 4. 全ルートの続行・凍結・廃止候補判定

| ルート | 現在利用 | キオスク依存 | 保存先 | 本番配置 | 必須CI | 仮判定 | 判定根拠 | 確定条件 |
|---|---|---|---|---|---|---|---|---|
| `/kiosk` | 実利用確認済み | 高 | 要確定 | 本番あり | K1 | 続行確定 | 運用入口の中心 | 本番Repositoryと正本の確定 |
| `/kiosk/toilet` | 実利用確認済み | 高 | 要確定（local/SharePoint） | 本番あり | K1 | 続行確定 | 主要実運用導線 | 本番Repositoryと正本の確定 |
| `/kiosk/users` | 実利用確認済み | 高 | 要確定 | 本番あり | K1 | 続行確定 | 利用者選択基盤 | 本番Repositoryと正本の確定 |
| `/kiosk/users/:userId/procedures` | 実利用確認済み | 高 | 要確定 | 本番あり | K1 | 続行確定 | 記録前提の主要画面 | 本番Repositoryと正本の確定 |
| `/kiosk/users/:userId/procedures/:slotKey` | 実利用確認済み | 高 | 要確定 | 本番あり | K1 | 続行確定 | 記録参照と訂正を担う中核 | 本番Repository、正本、訂正先の確定 |
| `/daily/attendance` | 利用実績未確認 | 中 | 要確定 | 本番あり | U | 要運用確認 | 到達可能だが運用実績未確認 | 利用実績ログ、保存先、戻り先の確認 |
| `/schedules/day` | 利用実績未確認 | 中 | 要確定 | 本番あり | U | 要運用確認 | 到達可能だが利用確認未済 | 利用実績ログと保存先の確認 |
| `/abc-record` | 利用実績未確認 | 中 | 要確認 | 未確定 | U | 要運用確認 | 同一アプリ内または外部連携の境界未確定 | 認証境界、保存先、戻り先の確定 |

`/schedules/day`は利用実績が不明なため、この個別導線をUとして扱う。

Scheduleの登録・編集・週次・月次・管理機能の凍結判断とは分ける。

`/daily/attendance`も同様に、出席機能全体の凍結判断とは分ける。

---

## 5. CI・E2Eの暫定分類

この分類は暫定である。

個別specとlane・jobが混在しているため、必須ゲートを決める前にspec粒度へ分解する。

### 5-1. 分類定義

- K1: キオスク画面の操作、保存、再読込、訂正を直接確認する。
- K2: 認証、利用者情報、SharePoint、セッションなどの共通基盤を確認する。
- F1: 凍結予定機能のみを確認する。
- U: 運用範囲または技術責任の境界が未確定で、現時点では続行・凍結を決められない。

### 5-2. 参考分類表

| spec・lane・job | 対象ルート | 区分 | キオスク必須 | 既知失敗 |
|---|---|---|---|---|
| `kiosk-*.spec.ts` | `/kiosk`主要5ルート | K1 | Yes | 未確認 |
| `kiosk-ux-regression.smoke.spec.ts` | `/kiosk`主要5ルートと画面遷移 | K1/U | Yes | 未確認 |
| `fixture-memory` lane | users/usability系を含む | K1/U | 対象spec分解後に判定 | 要分解 |
| `app-a11y` lane | usability全体 | U | 対象spec分解後に判定 | 要分解 |
| `sp-stub` lane | SharePoint検証混在 | K2/U | 対象spec分解後に判定 | 要分解 |
| `transport-*` lane | 送迎系導線 | U | 対象spec分解後に判定 | 要分解 |
| `implementation-hot` lane | 実装改善寄り混在 | F1/U | 対象spec分解後に判定 | 要分解 |
| `integration-*` lane | 横断統合 | U | 対象spec分解後に判定 | 要分解 |
| Quality Gates | 複数基盤 | K2/U | キオスク関連job抽出後に判定 | 要分解 |
| Nightly Health | 運用健全性全体 | U | キオスク関連job抽出後に判定 | 要分解 |
| schedule系spec | schedule関連 | F1/U | 個別導線確認後に判定 | 要分解 |
| billing・analysis・PDF・Excel・exception関連spec | 非kiosk機能中心 | F1/U | 原則非必須候補 | 要分解 |

---

## 6. npm依存と機能の対応

| パッケージ・依存領域 | 使用対象 | キオスク直接到達 | 本番必要性 | 判定 |
|---|---|---:|---|---|
| `exceljs` | 帳票・公式フォームのExcel出力 | No | 要確認 | 凍結機能専用か確認し、削除候補を精査する |
| `@react-pdf/renderer` | レポート・PDF系帳票 | No | 要確認 | 凍結機能専用か確認し、削除候補を精査する |
| 請求・国保連関連依存 | 月次・請求系 | No | 要確認 | 開発凍結候補 |
| Schedule関連依存 | スケジュール登録・週次・月次・管理 | No | 要確認 | 開発凍結候補 |
| Analysis関連依存 | 分析画面群 | No | 要確認 | 開発凍結候補 |

直接到達がないことだけでは、キオスクの間接依存がないとは証明できない。

依存削除は、キオスクビルドと回帰確認後に判断する。

---

## 7. 既存PRへの影響

| PR | 推奨扱い | 判定コメント |
|---|---|---|
| `#2501` | Draft HOLD | Exception Center凍結確定後はクローズ候補。追加修正、Ready化、マージは行わない |
| `#2483` | クローズ候補 | Deep lane基盤が`#2499`で置き換えられているか最終確認する |
| `#2475` | 要確認（Docs-only） | mainとの差分と文書の有効性を確認する |
| `#2459` | クローズ候補 | 同名または同目的の棚卸し文書との重複を確認する |
| `#2458` | クローズ候補 | Exception Center中心。凍結方針承認後に判断する |
| `#2452` | クローズ候補（条件付き） | Scheduleの対象範囲を確認後に判断する |
| `#2448` | クローズ候補（条件付き） | Schedule E2Eの対象範囲を確認後に判断する |
| `#2447` | クローズ候補（条件付き） | Schedule実装の対象範囲を確認後に判断する |
| `#2428` | HOLD | `exceljs`を本番依存から削除できるか確定するまで保留する |
| `#2393` | クローズ候補（条件付き） | Dashboard凍結方針の承認後に判断する |

PRのクローズ操作は、運用範囲の承認後に行う。

---

## 8. 不明点と運用確認事項

### 8-1. 本番Repositoryとデータ正本

次のルートについて、本番保存先、fallback、訂正先を確認する。

- `/kiosk/toilet`
- `/kiosk/users`
- `/kiosk/users/:userId/procedures`
- `/kiosk/users/:userId/procedures/:slotKey`
- `/daily/attendance`
- `/schedules/day`

### 8-2. `/abc-record`の境界

次を確認する。

- 同一アプリ内ルートか外部連携か
- 認証またはセッションの継承方法
- データ保存先
- キオスクへの戻り先
- 訂正方法

### 8-3. 旧ルート文字列の実利用

次の文字列が、定数、診断、リダイレクト、外部ブックマークのどれに使われているか確認する。

- `/kiosk-users`
- `/kiosk-procedures`

### 8-4. 関連ルートの利用実績

次のルートが実運用で使われているか、現場確認またはアクセスログで確認する。

- `/daily/attendance`
- `/schedules/day`
- `/abc-record`

### 8-5. 支援記録の取消・削除可否

`/kiosk/users/:userId/procedures/:slotKey`で扱う支援記録について、取消・削除の可否を現行業務契約から確認する。

トイレ記録の契約を流用して推定しない。

---

## 9. 次工程

### 9-1. 運用確認を先に行う

現場管理責任者、業務責任者、情報システム担当が、第8章の未確定事項を確認する。

確認結果が出るまで、Repository削除、ルート削除、CI削減、npm依存削除を行わない。

### 9-2. CIをspec粒度へ分解する

各specについて、次を記録する。

| specパス | 対象ルート | K1/K2/F1/U | 必須ゲート | 既知失敗 |
|---|---|---|---|---|

K1と、キオスクに必要なK2だけを将来の必須CI候補とする。

### 9-3. 範囲縮小実装を単一原因へ分割する

運用確認後、次を別PRで実施する。

1. 本番キオスクルートの固定
2. 非キオスクルートの本番除外
3. キオスク専用CIの追加または抽出
4. 凍結機能テストの非必須化
5. 不要依存の削除
6. 旧ルート処理の削除

各PRで、キオスク主要5ルートの認証、保存、再読込、訂正を確認する。

---

## 10. 判定要約

### 続行確定

- `/kiosk`
- `/kiosk/toilet`
- `/kiosk/users`
- `/kiosk/users/:userId/procedures`
- `/kiosk/users/:userId/procedures/:slotKey`

ただし、本番Repository、データ正本、訂正先は別途確定する。

### 要運用確認

- `/abc-record`
- `/daily/attendance`
- `/schedules/day`

### 開発凍結候補

- Scheduleのうちキオスク当日予定表示に不要な機能
- Billing
- Analysis
- Exception Center
- PDF・Excel・帳票機能

### 廃止候補

- 凍結機能専用と証明されたfixture
- 凍結機能専用と証明されたE2E
- 凍結機能専用と証明されたnpm依存
- 実利用がないと確認された旧ルート処理
- 後続PRで置き換え済みの旧PR

### 次の判断者

- 現場管理責任者
- 業務責任者
- 情報システム担当
