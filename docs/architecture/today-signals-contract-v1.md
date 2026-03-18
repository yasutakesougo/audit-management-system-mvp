# Today Signals Contract v1

Today画面を統合的な「福祉OSのコックピット」として機能させるための、Signal（信号）の契約書です。
各モジュール（Domain）は、Today画面を直接描画するのではなく、以下のルールの通りに規格化された Signal を Today Application 層（Action Queue Builder）に返します。

Today層はこれらのSignalを集約し、ユーザーの役割（Audience）と優先順位（Priority: P0〜P2）に基づいて表示を決定します。

## 1. 共通プロパティ定義

Signalが必ず持つべきデータ構造の定義（TypeScriptイメージ）です。

```typescript
type TodaySignalPriority = "P0" | "P1" | "P2";
type SignalAudience = "staff" | "admin" | "all"; // staff=現場職員, admin=サビ管/管理者

interface TodaySignal {
  id: string; // ユニークID（モジュール名＋対象ID等で生成。重複排除用）
  code: string; // Signal種類を特定するコード（例: 'daily_record_missing'）
  domain: string; // 発火元のモジュール名（例: 'DailyRecord', 'Planning'）
  priority: TodaySignalPriority; // 表示上の重要度
  audience: SignalAudience[]; // 表示対象となる役割
  title: string; // UIに表示するメインテキスト
  description?: string; // 補足情報
  actionPath: string; // クリック時の遷移先URLパス
  metadata?: Record<string, any>; // 件数や関連エンティティIDなど、グルーピングや追加判定に使うデータ
}
```

---

## 2. Signal コントラクト一覧 (MVPスコープ)

各モジュールがToday画面に向けて実装すべきSignalの規格・発火条件です。

### 2-1. Daily (日々の実行・記録) モジュール

| Signal Code               | Priority | Audience | Trigger Condition (発火条件)                                     | Action Path (遷移先)             | UI Display Template (例)                                 |
| :------------------------ | :------- | :------- | :--------------------------------------------------------------- | :------------------------------- | :------------------------------------------------------- |
| `daily_record_missing`    | **P0**   | staff    | 今日の予約がある利用者で、日次（活動）記録が未入力               | `/daily/records/new?client={id}` | `【未記録】${clientName}さんの活動記録が未入力です`      |
| `health_record_missing`   | **P1**   | staff    | 通所/入所予定の利用者で、バイタル・健康記録が未入力              | `/daily/health/new?client={id}`  | `【入力待ち】${clientName}さんの健康記録`                |
| `handoff_unread`          | **P1**   | all      | 当日の申し送り、または自分宛のメンションで未読状態のものがある   | `/daily/handoffs?focus={id}`     | `【未読の申し送り】${title}`                             |
| `record_approval_pending` | **P0**   | admin    | 日次・月次記録等で、管理者承認待ちのデータが存在する             | `/admin/approvals`               | `【承認待ち】${count}件の記録が承認を待っています`       |
| `today_schedule_summary`  | **P1**   | all      | （タスク等がない場合も）本日の支援予定や会議をサマリーとして出す | `/daily/schedules`               | `【本日の予定】利用者${count}名 / 会議${meetingCount}件` |

### 2-2. Planning (アセスメント・計画) モジュール

| Signal Code             | Priority | Audience     | Trigger Condition (発火条件)                                              | Action Path (遷移先)               | UI Display Template (例)                                        |
| :---------------------- | :------- | :----------- | :------------------------------------------------------------------------ | :--------------------------------- | :-------------------------------------------------------------- |
| `monitoring_overdue`    | **P0**   | admin        | モニタリングの実施期日を過ぎている利用者がいる                            | `/plans/monitoring?status=overdue` | `【期限超過】${clientName}さんのモニタリング期限が過ぎています` |
| `monitoring_due_soon`   | **P1**   | admin        | モニタリングの実施期日が14日以内に迫っている                              | `/plans/monitoring/{planId}`       | `【期日接近】${clientName}さんのモニタリング（あと${days}日）`  |
| `isp_renew_suggest`     | **P2**   | admin        | 個別支援計画（ISP）の見直し推奨時期（通常は有効期限の1〜2ヶ月前）に入った | `/plans/isp/{planId}/renew`        | `【計画見直し】${clientName}さんの支援計画更新時期です`         |
| `assessment_incomplete` | **P1**   | staff, admin | アセスメントが作成中のまま放置されている（一定日数経過）                  | `/assessments/{id}/edit`           | `【作成中】${clientName}さんのアセスメントが未完了です`         |

### 2-3. Analytics (分析・知見) モジュール

※ 分析モジュールは「結果のグラフ」を見せるのではなく、Today画面に対しては「現場での行動を変えるための気付き（示唆）」だけを Signal 化して送ります。

| Signal Code               | Priority | Audience | Trigger Condition (発火条件)                                                         | Action Path (遷移先)       | UI Display Template (例)                                              |
| :------------------------ | :------- | :------- | :----------------------------------------------------------------------------------- | :------------------------- | :-------------------------------------------------------------------- |
| `risk_health_alert`       | **P0**   | all      | 直近数日の健康記録や申し送りから、「体調不良の兆候」などのリスク判定が検知された場合 | `/clients/{id}/trends`     | `【要配慮】${clientName}さん: 直近で不眠/体調不良の傾向があります`    |
| `risk_behavioral_alert`   | **P1**   | all      | 行動記録等の集計から、環境変化等によるパニックや不穏の傾向が検知された場合           | `/clients/{id}/trends`     | `【要配慮】${clientName}さん: 環境変化による行動記録が増加しています` |
| `insight_positive_change` | **P2**   | all      | 定期的なデータ分析から、本人のポジティブな変化（目標達成の兆しなど）が抽出された場合 | `/analytics/insights/{id}` | `【良い変化】${clientName}さん: XXの項目で自立度が向上しています`     |

---

## 3. 今後の拡張時ルール

新しい機能や画面（例: 請求処理、コンプライアンス管理）を追加した際も、Today画面（UI）を直接修正するのではなく、以下の手順を踏みます。

1. そのモジュール用に **Signal Codeを新たに定義** し、この契約書 (Contract) に追記する。
2. モジュール側で発火条件（Trigger Condition）を判定し、`TodaySignal` オブジェクトを構築して Today層へ提供（提供用フックやAPI経由など）する。
3. Today層の統合ロジック（`buildTodayActionQueue`）は、Signalオブジェクトを入力として受け取り、Priority順 → Audienceフィルタ の共通規約でコンポーネントを描画する。

これにより、「Todayに自分たちの機能を出してほしい」という要望が増えても、UIのパッチワーク化を防ぎ、「福祉OSの入口としての優先順位の秩序」を保つことができます。
