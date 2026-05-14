このタスクでは、PR 1 の実装のみを行う。
目的は、Dedicated ABC 記録（AbcBehaviorRecords）を、L2 支援計画シート §9 評価欄の客観的根拠候補として「表示」することである。

評価欄への引用、転記、ドラフト生成、PlanningJson.monitoringEvidenceLinks[] への保存は、PR 2 以降で扱うため、本PRでは実装しない。

---

作業指示：PR 1「feat(planning-sheet): expose dedicated ABC evidence for evaluation」

目的:
Dedicated ABC 記録（AbcBehaviorRecords）を、L2 支援計画シート §9 評価欄の客観的根拠候補として表示できるようにする。

今回のスコープは PR 1 のみ。
評価欄への引用・転記・ドラフト生成・PlanningJson への evidenceLink 保存はまだ実装しない。

北極星:
Dedicated ABC は L1 個別支援計画に直接反映しない。
L2 支援計画シート §9 評価欄の客観的根拠として、職員確認後に引用されるものとする。

最重要確認点:
1. 表示のみ（読み取り専用）
2. 保存しない
3. 引用しない
4. DailyActivityRecords と統合しない
5. L1 個別支援計画へ反映しない

参照ドキュメント:
- docs/architecture/plan-abc-evidence-evaluation.md
- docs/architecture/abc-record-boundary.md

必ず守るガードレール:
1. AbcBehaviorRecords は読み取り専用の評価根拠候補として扱う。
2. DailyActivityRecords へ同期しない。
3. evaluationIndicator / evaluationMethod / improvementResult / nextSupport にはまだ書き込まない。
4. PlanningJson.monitoringEvidenceLinks[] への保存もまだ行わない。
5. SharePoint の列追加はしない。
6. IsDeleted=true の Dedicated ABC 記録は除外する。
7. slotId がない記録も除外せず、「その他のABC記録」として表示対象に残す。
8. sourceContext / 由来が分かる場合は UI 上で由来ラベルを表示する。
9. appliedFrom fallback による評価期間の場合は「暫定」扱いを UI で分かるようにする。
10. 既存の Support Date Governance を尊重する。

実装対象:
PR 1: feat(planning-sheet): expose dedicated ABC evidence for evaluation

やること:
1. 既存コード調査
   - AbcRecord 型を確認する。
   - SharePointAbcRecordRepository の既存メソッドを確認する。
   - 支援計画シート編集画面、新規フォーム、§9 モニタリング欄の構造を確認する。
   - SupportStartDate / ServiceStartDate / appliedFrom / MonitoringCycleDays の既存解決ロジックを確認する。

2. Dedicated ABC 取得処理の追加または既存メソッド活用
   - userId + 評価期間 from/to で AbcBehaviorRecords を取得できるようにする。
   - IsDeleted=true は除外する。
   - sourceContext が daily-support / kiosk-support / standalone / 未設定のいずれでも対象にする。
   - 期間外の記録は除外する。
   - 既存 repository に同等メソッドがある場合は新設せず再利用する。

   推奨インターフェース例:
   findByUserIdAndDateRange(input: {
     userId: string;
     from: string;
     to: string;
   }): Promise<AbcRecord[]>;

3. 評価期間の算出
   - 起点は既存の Support Date Governance に合わせる。
   - 優先順位:
     1. SupportPlanningSheet.SupportStartDate
     2. UserMaster.ServiceStartDate
     3. appliedFrom provisional fallback
   - 期間日数は MonitoringCycleDays を尊重する。
   - MonitoringCycleDays 未設定時は 90 日。
   - appliedFrom fallback の場合は provisional として扱う。

4. UI 追加
   - 支援計画シート編集画面、または §9 モニタリング欄周辺に「ABC根拠候補」セクションを追加する。
   - 初期表示はカードまたはリストでよい。
   - 表示項目:
     - 件数
     - 評価期間
     - 暫定算出かどうか
     - 発生日
     - 場面 / slotId
     - slotId がない場合は「その他のABC記録」
     - antecedent
     - behavior
     - consequence
     - intensity / riskFlag があれば表示
     - 由来ラベル

   由来ラベル例:
   - sourceContext が daily-support / kiosk-support: 「キオスク起点」
   - sourceContext が standalone: 「専用ABC画面起点」
   - sourceContext なし: 「由来不明/旧データ」

5. 空状態・エラー状態
   - 対象期間に記録がない場合:
     「対象期間内のABC根拠候補はありません」
   - 取得失敗時:
     画面全体を壊さず、ABC根拠候補セクションだけにエラー表示する。
   - 支援開始日起点が未設定の場合:
     既存の方針に合わせて警告表示または暫定扱いにする。

6. テスト追加
   最低限以下を追加する。

   Repository / hook:
   - userId + date range で取得できる
   - IsDeleted=true を除外する
   - 期間外を除外する
   - slotId なしを除外しない
   - sourceContext 未設定でも落ちない

   期間算出:
   - SupportStartDate 起点
   - ServiceStartDate fallback
   - appliedFrom provisional fallback
   - MonitoringCycleDays 未設定時は 90 日

   UI:
   - ABC根拠候補の件数が表示される
   - slotId ありは場面付きで表示される
   - slotId なしは「その他のABC記録」として表示される
   - 由来ラベルが表示される
   - 記録なし状態が表示される

やらないこと:
- AbcRecordEvidenceBridge.ts の要約生成はまだ作らない。
- improvementResult / nextSupport への転記はまだ作らない。
- 「評価欄へ引用」ボタンはまだ作らない。
- PlanningJson.monitoringEvidenceLinks[] への保存はまだ作らない。
- DailyActivityRecords への同期・統合はしない。
- L1 個別支援計画への反映はしない。
- SharePoint 列追加はしない。

推奨ブランチ名:
feat/planning-sheet-dedicated-abc-evidence

推奨 PR タイトル:
feat(planning-sheet): expose dedicated ABC evidence for evaluation

実行すべき検証:
- npm run typecheck
- 関連する planning-sheet テスト
- 関連する abc repository テスト
- 追加したテスト

PR 本文に必ず書くこと:
- Dedicated ABC を L2 §9 評価欄の根拠候補として表示する PR であること
- 今回は表示のみで、評価欄への引用・保存は未実装であること
- DailyActivityRecords へ同期しないこと
- L1 個別支援計画へ直接反映しないこと
- SharePoint 列追加を行っていないこと
- IsDeleted=true を除外し、slotId なし記録も救うこと
- Support Date Governance と MonitoringCycleDays に従うこと

完了条件:
- 支援計画シート画面で、評価期間内の AbcBehaviorRecords が「ABC根拠候補」として確認できる。
- 既存の支援計画シート保存処理や評価欄には影響しない。
- typecheck と関連テストが通る。
- PR 1 の範囲を超えた変更が入っていない。
