# 計画書：支援計画シート評価欄における Dedicated ABC 記録エビデンス活用計画

> **本計画は「計画立案のみ」を実行するものです。**  
> キオスク手順や専用画面から登録された「専用ABC記録（Dedicated ABC：`AbcBehaviorRecords`）」を、L1個別支援計画へ直接接続するのではなく、L2支援計画シートの§9評価欄（モニタリング欄）を裏付ける客観的エビデンスとして直接活用し、実証的な支援の評価と監査耐性の強化を両立させるためのデータ連携・UI設計・開発ロードマップを定義します。

---

## 1. 優先方針と中心設計

本システム独自の個別支援計画（L1）- 支援計画シート（L2）- 日次記録（L3）の3層モデルの責務境界を遵守し、**「L2支援計画シートの§9評価欄を、客観的なABC記録で直接裏付けること」** にスコープを完全に絞り込みます。

```
┌────────────────────────────────────────────────────────┐
│  専用ABC記録 (AbcBehaviorRecords)                       │
│  - キオスク/専用画面から入力された客観的事実            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ 【AbcRecordEvidenceBridge】（新設）
                           │   - 指定期間（開始日からサイクル日数）で抽出
                           │   - 場面・戦略・結果のパターンを自動解析
                           │   - 評価欄（§9）向けの要約・文章ドラフトを生成
                           ▼
┌────────────────────────────────────────────────────────┐
│  支援計画シート L2 §9 モニタリング欄                      │
│  - evaluationIndicator (評価指標)                       │
│  - evaluationPeriod (評価期間)                          │
│  - evaluationMethod (評価方法)                          │
│  - improvementResult (改善・変化の結果) ★最優先           │
│  - nextSupport (次回支援)                               │
└────────────────────────────────────────────────────────┘
```

### 評価項目へのマッピングと優先順位
1. **improvementResult (改善・変化の結果) ★最重要**: 
   - ABC記録の価値（何が起き、どの支援でどう変化したか）が最も直接反映されるため、最優先。
2. **nextSupport (次回支援)**: 
   - 記録上有効性が確認されたアプローチを次期支援に繋げる。
3. **evaluationMethod (評価方法)**: 
   - 専用ABC記録を評価根拠に用いている旨を明記。
4. **evaluationIndicator (評価指標)**: 
   - 場面や行動頻度に基づく指標化。
5. **evaluationPeriod (評価期間)**: 
   - 自動算出された客観的評価期間。

---

## 2. 補強設計ポイント

### ① 堅牢なエビデンス保存：`PlanningJson` の活用
SharePoint のスキーマ変更（列追加）による障害やデータドリフトを防止するため、引用元ABC記録ID等のメタデータは、既存の **`PlanningJson`** フィールドに内包して保存します。

```typescript
type PlanningMonitoringEvidenceLink = {
  source: 'dedicated-abc';
  sourceList: 'AbcBehaviorRecords';
  recordIds: string[];
  generatedAt: string;
  period: {
    from: string;
    to: string;
  };
  summaryText: string;
};

// 保存先イメージ
// PlanningJson.monitoringEvidenceLinks[]
```
これによって、既存のカラム定義を安全に維持しつつ、監査時における「エビデンスの完全な追跡性（トレーサビリティ）」を確保します。

### ② 評価期間の正確な算出（既存サイクルの尊重）
一律「支援開始日から90日間」ではなく、計画シートに定義されている `MonitoringCycleDays` を尊重します。

* **期間算出定義**:
  `SupportStartDate` を起点とし、`MonitoringCycleDays` が設定されている場合はその日数、未設定時は 90日間 とする。
* **起点の優先順位ルール (Support Date Governance)**:
  `SupportPlanningSheet.SupportStartDate`  
  `> UserMaster.ServiceStartDate`  
  `> appliedFrom provisional fallback`（※暫定 fallback の場合は、評価画面上に「暫定期間」と明示して安全性を担保する）

### ③ `sourceContext` に基づく多様なデータ抽出
キオスク起点だけでなく、専用画面から登録された過去のABCデータも網羅して抽出します。

* **抽出条件**:
  * 対象: `sourceContext` が `daily-support` / `kiosk-support` / `standalone` / 未設定（既存データ）のもの
  * 除外: `IsDeleted = true` / 対象利用者でない記録 / 算出された評価期間外の記録
* **UI上の由来（プロバナンス）表示**:
  監査時に説明を容易にするため、抽出されたエビデンスカードに以下の由来を表示します。
  * 「キオスク起点」
  * 「専用ABC画面起点」
  * 「由来不明/旧データ」

### ④ `slotId` の有無に配慮したフォールバック処理
キオスク起点でない記録には、手順スロット（`slotId`）が設定されていない場合があります。これを評価対象から落とさないよう、集計処理を以下のように分類します。

* **`slotId` あり**: 手順スロット別に、どの場面でどう変化したかを構造的に分析。
* **`slotId` なし**: 「その他のABC記録」として分類し、評価根拠候補に網羅して含める。

---

## 3. 段階的実装PRロードマップ（受け入れ条件付き）

### PR 1: `feat(planning-sheet): expose dedicated ABC evidence for evaluation`
* **目的**: 支援計画シート画面で、対象期間内の Dedicated ABC 記録を「評価根拠候補」として読める状態にする。
* **受け入れ条件**:
  * `AbcBehaviorRecords` を `userId` + 評価期間（算出ルール準拠）で取得できる。
  * `IsDeleted=true` の論理削除済みレコードが除外される。
  * 支援計画シートの編集画面に件数と、由来別（キオスク、専用画面等）のカード一覧が表示される。
  * この段階ではまだ評価欄への書き込み・反映は行わない。
  * `DailyActivityRecords`（Daily Behavior 系統）とは同期・統合しない。

### PR 2: `feat(planning-sheet): generate evaluation draft from ABC evidence`
* **目的**: ABC記録から §9 評価欄向けのドラフト文章を生成する。
* **受け入れ条件**:
  * `improvementResult` 用のドラフト要約文を自動生成できる。
  * `nextSupport` 用の候補文を自動生成できる。
  * `evaluationMethod` に「Dedicated ABC記録を根拠に含む」説明文言を生成できる。
  * 対象期間中の記録が0件の場合は空振りエラーにならず、「期間内の記録がありません」等の自然なメッセージを表示する。
  * すべて pure function（`AbcRecordEvidenceBridge.ts`）と Vitest による単体テストで完結し、UIから完全に分離されている。

### PR 3: `feat(planning-sheet): cite ABC evidence into evaluation fields`
* **目的**: 職員が確認したドラフトを、評価欄へ引用できるようにする。
* **受け入れ条件**:
  * 「評価欄へ引用」ボタンの押下により、`improvementResult` や `nextSupport` フォームに反映できる。
  * 既存テキストが存在する場合は上書き破壊せず、追記するか確認ダイアログ付きで置換する。
  * 引用元の `AbcRecord` IDリストを `PlanningJson.monitoringEvidenceLinks` に格納し、永続化する。
  * 自動での強制反映（バックグラウンド転記等）は行わず、必ず職員の操作・確認を契機とする。

---

## 4. 実装時の最重要ガードレール（開発者遵守）

1. **境界の遵守**: Dedicated ABC は L2評価欄の根拠であり、L1個別支援計画そのものではない。
2. **同期禁止**: `DailyActivityRecords`（日次行動記録系統）への自動複製や二重保存は絶対に行わない。
3. **SSOT原則**: `AbcBehaviorRecords` は一次証跡（真実のソース）としてそのまま保持し、計画シート側には `PlanningJson` 内の引用リンク（ID）のみを保持する。
4. **意思決定権の留保**: 評価欄（`improvementResult` 等）への反映は、必ず職員確認後の能動的な引用操作に限定する。
5. **客観的トーンの徹底**: 自動生成される文面は、行政監査で専門職の職能的裁量を守るため、「断定（例：～でした）」ではなく、「客観的記録からの示唆（例：〜の記録が確認された、〜の可能性がある）」という表現に統一する。

---

## 5. 結論

> **本機能は、Dedicated ABC記録をL1個別支援計画へ自動反映するものではなく、L2支援計画シートの§9評価欄において、職員が専門的判断を行うための客観的エビデンス候補と評価ドラフトを提示するものである。評価欄への反映は職員確認後の引用操作に限定し、引用元ABC記録IDを `evidenceLink` として保持することで、監査時に評価根拠を追跡可能にする。**
