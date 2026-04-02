# fix(sharepoint): harden drift diagnostics and field resolution for operational lists

## 概要
SharePoint リストのスキーマドリフト耐性（Drift Resilience）を主要な運用リストへ横展開し、診断基盤を硬化しました。
これにより、SharePoint 側で内部名が自動変更（サフィックス付与等）された場合でも、アプリ側で動的に名前を解決し、致命的なエラーを回避（WARN 状態で動作継続）できるようになります。

Closes #1362 (Drift Resistance 横展開)

## 変更内容
### 追加
- **ドリフト耐性定義の追加 (CANDIDATES / ESSENTIALS):**
  - `meeting_minutes` (議事録)
  - `handoff` (引き継ぎ)
  - `meeting_sessions` (会議セッション)
  - `nurse_observations` (看護観察)
  - `daily_activity_records` (日次活動記録)
- **新規ドリフト検証テストの追加 (29件):**
  - `meetingMinutesFields.drift.spec.ts`
  - `handoffFields.drift.spec.ts`
  - `meetingSessionFields.drift.spec.ts`
  - `nurseObservationFields.drift.spec.ts`

### 修正・調整
- `HealthPage.tsx`: `meeting_minutes`, `handoff`, `meeting_sessions`, `nurse_observations`, `daily_activity_records` を診断レジストリ `DRIFT_CANDIDATES_BY_KEY` に追加し、既存の drift 監視対象と合わせて主要運用リストを監視可能にしました。
- `HANDOFF.md`: 完了済みの横展開リストおよび運用引き継ぎ情報の更新
- 既存テストの修正: 型定義の厳格化に伴う期待値の調整 (`billingFields`, `surveyTokuseiFields`, `usersMasterFields`)

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------| 
| `src/sharepoint/fields/meetingMinutesFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/handoffFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/nurseObservationFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/meetingSessionFields.ts` | 追加 | CANDIDATES/ESSENTIALS 新規定義 |
| `src/pages/HealthPage.tsx` | 変更 | 診断レジストリへの追加、型キャストの修正 |
| `src/sharepoint/fields/__tests__/*.drift.spec.ts` | 追加/修正 | 計18ファイル・145件のドリフト検証テスト |

## テスト
- [x] 既存テスト通過: `npx vitest run src/sharepoint/fields/__tests__/*.drift.spec.ts` (145/145 pass)
- [x] 型チェック通過: `tsc --noEmit`
- [x] 新規テスト追加: 各追加ドメインに対して、正常解決・ドリフト解決・必須項目バリデーションを網羅

**テスト統計:**
- **今回追加したテスト数**: 29件
- **全体のドリフトテスト総数**: 145件 (すべて Green)

## 影響範囲と運用ステータス
- **診断ダッシュボード**: `/admin/status` で主要リストすべての整合性が可視化されます。
- **残 FAIL の整理**: 現在の FAIL は SharePoint 側の環境・権限（列不足、アクセス拒否）に起因するもののみで、**今回の対象範囲におけるコード起因の誤 FAIL・固定内部名依存は解消済み** です。

## 補足
今回の変更により、SharePoint の内部名ドリフトが発生しても、
- 物理名の揺れは `CANDIDATES` で吸収
- 必須欠落のみ `FAIL`
- 代替名解決は `WARN`
- 管理者対応は `/admin/status` と runbook で案内
という運用契約が主要リスト全体で一貫しました。
