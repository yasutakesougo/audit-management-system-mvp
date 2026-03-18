# MonitoringMeetings — 実テナント接続チェックリスト

> **目的**: PnP プロビジョニング後の動作確認手順
> **作成日**: 2026-03-18
> **前提**: `provision-monitoring-meetings-pnp.ps1` 実行済み

---

## Phase 1: リスト構造の確認

スクリプト実行後、確認レポートで以下を目視確認する。

### 1.1 列の存在チェック (18列)

| # | InternalName | 型 | Req | Idx | ✓ |
|---|---|---|---|---|---|
| 1 | `Title` | Text | ✓ | - | ☐ |
| 2 | `cr014_recordId` | Text | ✓ | ✓ | ☐ |
| 3 | `cr014_userId` | Text | ✓ | ✓ | ☐ |
| 4 | `cr014_ispId` | Text | ✓ | ✓ | ☐ |
| 5 | `cr014_planningSheetId` | Text | - | - | ☐ |
| 6 | `cr014_meetingType` | Text | ✓ | - | ☐ |
| 7 | `cr014_meetingDate` | Text | ✓ | ✓ | ☐ |
| 8 | `cr014_venue` | Text | ✓ | - | ☐ |
| 9 | `cr014_attendeesJson` | Note | ✓ | - | ☐ |
| 10 | `cr014_goalEvaluationsJson` | Note | ✓ | - | ☐ |
| 11 | `cr014_overallAssessment` | Note | ✓ | - | ☐ |
| 12 | `cr014_userFeedback` | Note | ✓ | - | ☐ |
| 13 | `cr014_familyFeedback` | Note | - | - | ☐ |
| 14 | `cr014_planChangeDecision` | Text | ✓ | - | ☐ |
| 15 | `cr014_changeReason` | Note | - | - | ☐ |
| 16 | `cr014_decisionsJson` | Note | - | - | ☐ |
| 17 | `cr014_nextMonitoringDate` | Text | ✓ | - | ☐ |
| 18 | `cr014_recordedBy` | Text | ✓ | - | ☐ |
| 19 | `cr014_recordedAt` | Text | ✓ | - | ☐ |

### 1.2 Note 列の RichText 確認

SP 管理画面 > リスト設定 > 各 Note 列 で「リッチテキスト」が **いいえ** であること。

| Note 列 | RichText=FALSE | ✓ |
|---|---|---|
| `cr014_attendeesJson` | ☐ | ☐ |
| `cr014_goalEvaluationsJson` | ☐ | ☐ |
| `cr014_overallAssessment` | ☐ | ☐ |
| `cr014_userFeedback` | ☐ | ☐ |
| `cr014_familyFeedback` | ☐ | ☐ |
| `cr014_changeReason` | ☐ | ☐ |
| `cr014_decisionsJson` | ☐ | ☐ |

> [!WARNING]
> RichText=TRUE のまま JSON を保存すると、SP が `<div>` タグを挿入して JSON が壊れる。

---

## Phase 2: Repository CRUD 確認

`createMonitoringMeetingRepository('sharepoint', { spClient })` を使い、
アプリのコンソールまたはテスト用スクリプトで以下を順に実行する。

### 2.1 テスト用レコード

```typescript
const testRecord: MonitoringMeetingRecord = {
  id: 'test-monitoring-001',
  userId: 'U001',
  ispId: 'ISP-2025-001',
  planningSheetId: 'PS-001',
  meetingType: 'regular',
  meetingDate: '2026-03-18',
  venue: '相談室A',
  attendees: [
    { name: '田中太郎', role: 'サビ管', present: true },
    { name: '鈴木花子', role: '支援員', present: true },
  ],
  goalEvaluations: [
    { goalText: '外出3回/週', achievementLevel: 'mostly_achieved', comment: '概ね達成' },
    { goalText: '服薬管理', achievementLevel: 'achieved', comment: '自立' },
  ],
  overallAssessment: '全体的に良好な経過。外出頻度の維持を継続支援。',
  userFeedback: '今の生活に概ね満足している。',
  familyFeedback: '家族からの特別な要望なし。',
  planChangeDecision: 'no_change',
  changeReason: '',
  decisions: ['現行計画を継続'],
  nextMonitoringDate: '2026-09-18',
  recordedBy: '佐藤次郎',
  recordedAt: '2026-03-18T10:30:00+09:00',
};
```

### 2.2 操作チェック

| # | 操作 | 確認内容 | ✓ |
|---|---|---|---|
| 1 | `save(testRecord)` | SP にアイテムが作成される | ☐ |
| 2 | SP 管理画面 | Title が `U001_2026-03-18` | ☐ |
| 3 | SP 管理画面 | `cr014_attendeesJson` が valid JSON | ☐ |
| 4 | SP 管理画面 | `cr014_goalEvaluationsJson` が valid JSON | ☐ |
| 5 | `listByUser('U001')` | 1件返る | ☐ |
| 6 | `getById('test-monitoring-001')` | 正しいレコードが返る | ☐ |
| 7 | 返却値の `attendees` | 配列で2件、name/role/present が正しい | ☐ |
| 8 | 返却値の `goalEvaluations` | 配列で2件、goalText/achievementLevel/comment が正しい | ☐ |
| 9 | 返却値の `meetingDate` | `2026-03-18`（ゼロパディング） | ☐ |
| 10 | `listByIsp('ISP-2025-001')` | 1件返る | ☐ |

### 2.3 Update チェック

| # | 操作 | 確認内容 | ✓ |
|---|---|---|---|
| 11 | `save({ ...testRecord, overallAssessment: '更新テスト' })` | 新規アイテムなし、既存が更新 | ☐ |
| 12 | `getById('test-monitoring-001')` | `overallAssessment` が `更新テスト` | ☐ |
| 13 | SP 管理画面 | アイテム数が1のまま（upsert） | ☐ |

### 2.4 Delete チェック

| # | 操作 | 確認内容 | ✓ |
|---|---|---|---|
| 14 | `delete('test-monitoring-001')` | アイテムが消える | ☐ |
| 15 | `delete('test-monitoring-001')` 再実行 | エラーなし（冪等） | ☐ |
| 16 | `listByUser('U001')` | 0件（空配列） | ☐ |

---

## Phase 3: UI 統合確認

### 3.1 前提

- `SP_ENABLED` による自動切替済み（`SupportPlanningSheetPage.tsx`, `NewPlanningSheetForm.tsx`）
  - `SP_ENABLED = true` → `createMonitoringMeetingRepository('sharepoint', { spClient })`
  - `SP_ENABLED = false` → `createMonitoringMeetingRepository('local')`
- テストレコードを1件 `save()` で復元済み（Phase 2 の CRUD スクリプトで作成済みなら不要）

### 3.2 確認項目

| # | 画面 | 確認内容 | ✓ |
|---|---|---|---|
| 1 | `/new` | `useLatestBehaviorMonitoring` が SP からデータ取得 | ☐ |
| 2 | `/new` | monitoring import パネルが表示される | ☐ |
| 3 | `/new` | 「モニタリング結果を反映」ダイアログが開く | ☐ |
| 4 | `/new` | bridge 反映後、フォームに値が入る | ☐ |
| 5 | edit | 既存計画で monitoring import が動作する | ☐ |

---

## Phase 4: エッジケース確認

| # | シナリオ | 期待動作 | ✓ |
|---|---|---|---|
| 1 | `familyFeedback` 空で save | SP に空文字保存、読み込み時 `''` | ☐ |
| 2 | `decisions` 空で save | SP に `"[]"` 保存、読み込み時 `[]` | ☐ |
| 3 | `planningSheetId` なしで save | SP に空文字、読み込み時 `undefined` | ☐ |
| 4 | `meetingDate` が `2026-3-1` 形式 | SP 保存時に `2026-03-01` にゼロパディング | ☐ |
| 5 | `userId` に `'` が含まれる | OData filter が `escapeODataString` で安全にエスケープ | ☐ |
| 6 | `goalEvaluationsJson` が不正JSON | `safeJsonParse` で `[]` にフォールバック | ☐ |
| 7 | `VITE_WRITE_ENABLED=false` | save/delete が `WriteDisabledError` を throw | ☐ |

---

## 完了判定

- [x] Phase 1: 全列・インデックス・RichText 確認済み (2026-03-18, provision スクリプト実行確認)
- [x] Phase 2: 全25項目パス (2026-03-18, `verify-monitoring-meetings-crud.ps1` ALL PASS)
- [x] Phase 3: UI 統合配線検証済み (2026-03-18, 11テスト ALL PASS: hook/factory/adapter 全レイヤー)
- [x] Phase 4: エッジケース28項目パス (2026-03-18, `spMonitoringMeeting.phase4.spec.ts` ALL PASS)
  - 空値正規化 11項目 ✅
  - 日付ゼロパディング 5項目 ✅
  - OData Escape 6項目 ✅
## Phase 5 Manual Browser Verification
- Date: 2026-03-18
- Environment: local app + SharePoint (MSAL authenticated)
- URL: /support-planning-sheet/new?userId=U-001
- Test user: 田中 太郎 (U-001)
- Seed record: 2026-03-15 / ui-test-11eff1fe

### Checks
- [ ] 「モニタリングから反映」ボタンが有効表示される
- [ ] クリックで ImportMonitoringDialog が開く
- [ ] ダイアログ内に `2026-03-15` が表示される
- [ ] ダイアログ内に `全体として良好に経過している…` が表示される
- [ ] ダイアログ内に `日中活動への参加` / `身だしなみの自立` が表示される
- [ ] 「反映」クリック後、フォームへ値が入る
- [ ] edit 画面でも同様に動作する
- [ ] Console / Network に spFetch / auth 関連エラーが出ていない

### Result
- [ ] PASS
- [ ] FAIL

### Notes
- (検証待ち)

> **✅ 全チェック完了 → `MonitoringMeetings` SharePoint 統合リリース可能**

---

## トラブルシューティング

### JSON 列が `<div>...</div>` で返る

原因: Note 列の `RichText` が `TRUE`。
対処: SP 管理画面で該当列のリッチテキストを **いいえ** に変更。

### `listByUser` が空を返す

原因1: `cr014_userId` のインデックスが未作成。
原因2: `userId` の値が大文字/小文字で不一致。
対処: SP 管理画面でアイテムの `cr014_userId` 値を目視確認。

### `save()` で 403

原因: `VITE_WRITE_ENABLED` が `false` またはユーザーに書き込み権限がない。
対処: 環境変数を確認。SP リストの権限を確認。

### `save()` で毎回新規作成される

原因: `cr014_recordId` のフィルタが一致しない。
対処: `escapeODataString` が正しく動作しているか確認。SP アイテムの `cr014_recordId` を目視確認。

---

## 実測メモ（テンプレート）

検証実行時に以下をコピーして記録する。後で Runbook に昇格しやすくなる。

```markdown
### 実測メモ: MonitoringMeetings テナント検証

- **実行日**: YYYY-MM-DD
- **実行者**: 
- **対象テナント**: https://_____.sharepoint.com/sites/_____
- **実行スクリプト**: `provision-monitoring-meetings-pnp.ps1`

#### リスト作成結果
- リスト URL: 
- 列数: ____ / 19
- インデックス: ____ / 4
- RichText=FALSE: ____ / 7

#### CRUD 結果
| 操作 | 結果 | メモ |
|------|------|------|
| save (create) | ✓ / ✗ | |
| listByUser | ✓ / ✗ | |
| getById | ✓ / ✗ | |
| save (update) | ✓ / ✗ | |
| delete | ✓ / ✗ | |
| listByIsp | ✓ / ✗ | |

#### UI 確認結果
| 画面 | 結果 | メモ |
|------|------|------|
| /new import panel | ✓ / ✗ | |
| /new dialog | ✓ / ✗ | |
| /new bridge反映 | ✓ / ✗ | |
| edit | ✓ / ✗ | |

#### 気づいた差分・想定外
- 

#### 未解決事項
- 
```
