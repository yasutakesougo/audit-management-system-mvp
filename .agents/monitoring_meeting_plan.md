# 資格要件込みモニタリング会議記録 実装計画 (強度行動障害支援対応)

## 1. 目的
強度行動障害支援におけるモニタリング会議の精度を向上させ、監査対応（加算証跡）を確実にする。

## 2. 変更内容
### データ構造 (Schema) [完了済み]
- **Staff_Master**: `hasBasicBehaviorSupportTraining`, `hasPracticalBehaviorSupportTraining` 等を追加。
- **MonitoringMeetings**: `implementationSummary`, `behaviorChangeSummary`, `discussionSummary` 等、監査に必要な自由記述欄を大幅拡張。

### UI 機能
- **起点選択**: 利用者選択後、対象の「支援計画シート」を選択必須に。
- **参加者要件判定**: 
    - 選択したスタッフの資格バッジを表示（基礎・実践）。
    - 判定バー: 「基礎研修修了者: ✅」「実践研修修了者: ✅」をリアルタイム表示。
- **記録自動引用**: 日次記録サマリや ABC 分析結果を引用し、転記ミスを防止。

## 3. 次のステップ (実装着手)
1. `src/features/monitoring/components/MonitoringMeetingForm.tsx` の作成。
2. `src/pages/MonitoringMeetingRecordPage.tsx` の作成とルーティング追加。
