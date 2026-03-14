# Date Format Phase 4 Report

> Phase 4: 仕上げ・wrapper整理・運用ルール固定 (2026-03-14)

## Summary

| 指標 | 結果 |
|---|---|
| wrappers inventoried | 8 |
| wrappers removed | 3 |
| wrappers kept | 2 |
| wrappers kept temporarily | 2 |
| manual review required | 1 |
| new guidelines added | yes (`docs/date-format-guidelines.md`) |
| typecheck | ✅ pass |
| lint | ✅ clean |
| test | ✅ 137 tests pass |
| build | ✅ success (43.47s) |

---

## Wrapper Classification

| # | path | wrapper | shared API | classification | reason | next action |
|---|---|---|---|---|---|---|
| 1 | `support-plan-guide/utils/helpers.ts` | `formatDateJP` | `formatDateYmd` | Keep Temporarily | 4外部呼び出し (FieldCard, pdfExport, 内部2箇所)。alias名が feature 全体で浸透 | 呼び出し元を1つずつ `formatDateYmd` に置換し、0になったら削除 |
| 2 | `ibd/.../supportPlanDeadline.ts` | `formatDateJP` | `formatDateYmd` | Keep Temporarily | 3外部呼び出し (supportPlanPrintView, 内部2箇所) | 同上 |
| 3 | `daily/.../MonitoringCountdown.tsx` | `formatDate` | `formatDateYmd` | **Remove Now** → ✅ 削除済 | private const、2呼び出しのみ。`formatDateYmd` と名前が曖昧 | 完了 |
| 4 | `schedules/.../DaySummaryDrawer.tsx` | `formatDateDisplay` | `formatDateJapanese` | **Remove Now** → ✅ 削除済 | private、1呼び出しのみ。`formatDateJapanese` と同義 | 完了 |
| 5 | `daily/infra/InMemoryDailyRepo...` | `formatDateLocal` | `formatDateIso` | **Remove Now** → ✅ 削除済 | private、1呼び出しのみ。既に `@deprecated` 付き | 完了 |
| 6 | `dashboard/.../useRoomReservations.ts` | `formatDateDisplay` | `safeFormatDate` | Keep | hook 戻り値。カスタム M/D(曜) フォーマッターとして semantic name に価値あり | 維持 |
| 7 | `handoff/.../useHandoffDateNav.ts` | `formatDateLocal` | `formatDateIso` | Keep | 15+呼び出し (4ファイル跨ぎ)。`d = new Date()` デフォルト引数が必須 | 維持。将来的に呼び出し元で直接 `formatDateIso` を使う移行を検討 |
| 8 | `users/.../helpers.tsx` | `formatDateLabel` | `formatDateJapanese` | Keep | Extra semantics: `'未設定'` fallback + parse 失敗時 → raw value | 維持。ドメイン固有 fallback |

---

## Removed Wrappers

| # | path | what changed | output changed? |
|---|---|---|---|
| 1 | `features/daily/components/MonitoringCountdown.tsx` | `const formatDate = (d) => formatDateYmd(d)` 削除。2箇所の `formatDate(...)` を `formatDateYmd(...)` に直接置換 | no |
| 2 | `features/schedules/components/DaySummaryDrawer.tsx` | `const formatDateDisplay = (iso) => formatDateJapanese(iso)` 削除。1箇所の呼び出しを `formatDateJapanese(...)` に直接置換 | no |
| 3 | `features/daily/infra/InMemoryDailyRecordRepository.ts` | `const formatDateLocal = (date) => formatDateIso(date)` 削除。1箇所の呼び出しを `formatDateIso(...)` に直接置換 | no |

---

## Kept Wrappers

| # | path | why kept | deprecation? |
|---|---|---|---|
| 1 | `support-plan-guide/utils/helpers.ts` → `formatDateJP` | 4外部呼び出し。feature 全体の alias 名 | ✅ `@deprecated` 済 |
| 2 | `ibd/.../supportPlanDeadline.ts` → `formatDateJP` | 3外部呼び出し。printView 含む | ✅ `@deprecated` 済 |
| 3 | `dashboard/.../useRoomReservations.ts` → `formatDateDisplay` | hook 戻り値。カスタム曜日表示 | ❌ (semantic name として維持) |
| 4 | `handoff/.../useHandoffDateNav.ts` → `formatDateLocal` | 15+呼び出し。デフォルト引数必須 | ✅ `@deprecated` 済 |
| 5 | `users/.../helpers.tsx` → `formatDateLabel` | `'未設定'` fallback + parse 失敗 → raw value | ❌ (ドメイン固有 wrapper) |

---

## Remaining Inline Date Formatting

| カテゴリ | 件数 | リスク |
|---|---|---|
| `toLocaleDateString('ja-JP', ...)` — presentational | ~10件 | 低〜中。`month:'short'` / `weekday` の環境依存が課題 |
| `relativeTime` 内の fallback | 3件 | 中。3ファイルに同一パターン散在。共通化推奨 |
| `toLocaleDateString()` — デフォルト locale | 1件 | 低。ImportSurveyDialog |
| `Intl.DateTimeFormat` 直接呼び出し | 1件 | 低。tokuseiSurveyHelpers |

合計: ~15件のインライン日付整形が残存

---

## High-Risk Deferred Items

以下は今回も変更禁止として維持:

1. `lib/mappers/schedule.ts` — TZ変換関数。SharePoint連携の日付変換
2. `AuditEvidenceReportPDF.tsx` — 帳票内フォーマット。PDF出力テスト必須
3. `ScheduleViewDialog.formatDateTime` — `date-fns-tz` 依存
4. `scheduleFormState.formatDateTimeLocal` — `date-fns` 依存
5. domain / repository / billing / monitoring / audit log 全般

---

## Suggested Follow-up Issues

### Issue A: `relativeTime` 共通化
- 対象: `IncidentHistoryList`, `RestraintHistoryList`, `ImportHistoryPanel`
- 内容: 同一パターンの `relativeTime` 関数を `lib/dateFormat.ts` に追加
- リスク: 低（presentational helper）
- 推奨ラベル: `refactor`, `tech-debt`

### Issue B: `@deprecated` wrapper の段階削除
- 対象: `formatDateJP` (2ファイル), `formatDateLocal` (useHandoffDateNav)
- 内容: 外部呼び出し元を直接 `dateFormat.ts` API に切り替え
- リスク: 低（出力同一、差分大）
- 推奨ラベル: `refactor`

### Issue C: 残インライン `toLocaleDateString` 統合
- 対象: ~10件
- 内容: `month:'short'` 等の環境依存パターンの互換性確認と段階置換
- リスク: 中（ブラウザ依存出力のテスト確認が必要）
- 推奨ラベル: `refactor`, `tech-debt`

### Issue D: `tokuseiSurveyHelpers.formatDateTime` 統合
- 対象: 1件
- 内容: assessment ドメイン見直し時に対応
- リスク: 中（独自 fallback 仕様）
- 推奨ラベル: `refactor`

---

## Phase 1–4 全体統計

| 指標 | 値 |
|---|---|
| 共通 API 関数数 | 7 (`dateFormat.ts`) |
| Phase 1 テスト | 58 |
| Phase 2 置換 | 6件 |
| Phase 2 テスト追加 | 24 |
| Phase 3 置換 | 4件 + インライン3件 |
| Phase 3 テスト追加 | 26 |
| Phase 4 wrapper 削除 | 3件 |
| Phase 4 wrapper 維持 | 5件 |
| 累計テスト | 137 (全パス) |
| 残インライン | ~15件 |
| 残 wrapper | 5件 |
| ガイドライン | `docs/date-format-guidelines.md` |

---

## #911 Close 判定

**Close 可能**。

理由:
- 共通 API が運用段階に入っている (Phase 2/3 で実証)
- wrapper 整理が完了し、残 wrapper には理由と注記がある
- ガイドラインにより新規コードでの再発防止策が整備された
- 高リスク領域は意図的に未着手であり、別 Issue で扱うべきもの
- 残インラインと wrapper 段階削除は、別 Issue で継続可能

推奨 close コメント:
> Phase 1–4 完了。共通 API 7関数整備、13箇所置換、3 wrapper 削除、ガイドライン追加。
> 残作業は #xxx (relativeTime共通化), #xxx (wrapper段階削除), #xxx (インライン統合) に分離。

---

## 変更ファイル一覧

### ソースファイル (3件)
- `src/features/daily/components/MonitoringCountdown.tsx` (wrapper削除)
- `src/features/schedules/components/DaySummaryDrawer.tsx` (wrapper削除)
- `src/features/daily/infra/InMemoryDailyRecordRepository.ts` (wrapper削除)

### ドキュメント (3件)
- `docs/date-format-guidelines.md` (新規)
- `docs/date-format-inventory.md` (更新)
- `docs/date-format-phase4-report.md` (本ファイル、新規)
