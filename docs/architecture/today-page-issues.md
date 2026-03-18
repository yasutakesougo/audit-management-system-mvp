# Today Signals 実装用 Issue テンプレート

Today画面（福祉OSのホーム）をMVPとして実装するための3分割Issueです。
このままGitHubにコピペして利用できます。

---

## Issue A: Today Signals Domain SSOT

**Title:** `feat(today): define TodaySignal domain schemas and MVP contracts`

### 背景・目的

Today層は単なる画面ではなく、「各モジュールが発火するSignalを統合して役割別に行動へ変換する層」です。
まずは全モジュールが共通で参照する `TodaySignal` の型定義と、MVPで扱うSignal Code群をSSOT（Single Source of Truth）として定義します。
ref: `docs/architecture/today-signals-contract-v1.md`

### タスク内容

- [ ] `src/features/today/types/todaySignal.types.ts` を作成
  - `TodaySignalPriority` (`'P0' | 'P1' | 'P2'`)
  - `SignalAudience` (`'staff' | 'admin' | 'all'`)
  - `TodaySignal` interface
- [ ] `TodaySignalCode` を string union 型として定義（MVP用の6つ）
  - `daily_record_missing`
  - `health_record_missing`
  - `handoff_unread`
  - `monitoring_overdue`
  - `monitoring_due_soon`
  - `risk_health_alert`
- [ ] UI表示名（actionLabel や prefix）をContractに従って管理する Map or 定数ファイルの作成

### 実装上の決定事項（制約）

- Signalの重複判定用に `id` （例: `code-clientId` 等）を必須とする。
- P0の最大表示件数はフロントエンドで制御するため、Signalジェネレータは件数を絞らずに返すこと。

---

## Issue B: buildTodayActionQueue MVP

**Title:** `feat(today): implement buildTodayActionQueue core logic`

### 背景・目的

Issue Aで定義した規格化されたSignal群を受け取り、優先順位（Priority）と権限（Audience）に基づいて、正しく整列・フィルタ・重複排除（dedupe）を行う純粋関数（pure function）を実装します。

### タスク内容

- [ ] 各モジュールのデータをモックまたは仮取得し、`TodaySignal[]` の生リストを生成するダミーFetcherを作成（MVP用）
- [ ] `buildTodayActionQueue(signals: TodaySignal[], currentRole: Role): TodaySignal[]` の実装
  - **Filter**: `currentRole` に合致しない (`audience` 不一致の) Signal を弾く
  - **Dedupe**: 同一ID（同一利用者・同一イベント）の重複をマージ/削除するロジック
  - **Sort**: P0 → P1 → P2 の順でソートする
- [ ] 上記ロジックに対する単体テスト (`buildTodayActionQueue.test.ts`) の作成
  - audienceごとの表示制御が効いているか
  - P0が必ず上に来ているかの検証

---

## Issue C: TodayPage MVP widgets

**Title:** `feat(today): build TodayPage MVP UI components`

### 背景・目的

Issue Bで整理された `ActionQueue` (優先順位付けされた `TodaySignal[]` ) を受け取り、ユーザーにワンクリックのアクションを促す「福祉OSのコックピット」UIを実装します。

### タスク内容

- [ ] `Presentational: TodayPage` の大枠レイアウト（P0用のNext Action枠 + 通常ショートカット枠）の作成
- [ ] 以下のWidgetコンポーネントを作成し、`buildTodayActionQueue` の結果を流し込む
  - **Hero Summary**: 「未記録がX件あります」等の状態サマリー
  - **Next Action Panel**: P0用の目立つ行動誘導カード
  - **Today Shortcuts**: 日次記録・健康記録への標準ショートカットボタン
  - **Alerts Panel**: P2の注意アラート表示
  - **Handoff Panel**: P1の申し送り未読表示
- [ ] (Optional) タスク消化時（カードクリック等）のOptimistic Update（UI上から一旦消す処理）のフック実装

### UX上の制約

- 画面はカードやリンクの羅列ではなく、「未処理のアクション」が前面に出るようにする。
- 遷移先 (`actionPath`) が設定されていないSignalは存在してはならない（ワンクリックで処理に行けること）。
