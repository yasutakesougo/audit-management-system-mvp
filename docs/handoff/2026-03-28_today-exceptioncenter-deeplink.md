# Handoff: Today → ExceptionCenter Deep Link

## Summary

- Today の「司令塔優先」チップから ExceptionCenter へ直接遷移できる導線を追加。
- 遷移時に `category` / `userId` / `source` を query で引き継ぎ、ExceptionCenter 側で復元して絞り込みに適用。
- 既存の NextAction 導線は変更せず、Today の要確認導線のみを薄く拡張。

## UI品質状況

- カバレッジ: `docs/qa/a11y-usability-gate-coverage-2026-03-28.md` に連携強化内容を反映済み。
- 新規/改修時は `docs/checklists/a11y-usability-rollout-checklist.md` を適用すること。

## Done

- [x] deep link util を追加（build/parse 契約）
- [x] Today `司令塔優先` チップのクリック遷移を追加
- [x] ExceptionCenter で query を復元し `category/userId` 絞り込みを適用
- [x] UI 契約テストと util テストを追加

## Verification

- [x] `npx vitest run src/features/exceptions/domain/__tests__/exceptionCenterDeepLink.spec.ts src/features/today/components/TodayExceptionAlerts.spec.tsx src/features/today/domain/__tests__/selectTopExceptionAttentionCandidate.spec.ts src/features/exceptions/domain/__tests__/computeExceptionPriorityScore.spec.ts src/features/exceptions/components/__tests__/ExceptionTable.logic.spec.ts`
- [x] `npx eslint src/features/exceptions/domain/exceptionCenterDeepLink.ts src/features/exceptions/domain/__tests__/exceptionCenterDeepLink.spec.ts src/features/today/components/TodayExceptionAlerts.tsx src/features/today/components/TodayExceptionAlerts.spec.tsx src/pages/admin/ExceptionCenterPage.tsx`
- [ ] `npm run -s typecheck` は既知の変更外エラーで失敗（`src/features/callLogs/components/NextCallHero.tsx`）

## Open Risks / Follow-ups

- [ ] `source=today` を使った追加 UI（戻る導線、コンテキストバナー最適化）は未実装。
- [ ] ExceptionCenter 側の deep link 復元に対するページ統合テストは未追加。

## Next Step

1. `source=today` 利用時の表示最適化（戻る導線/案内文）を実装する。
2. ExceptionCenter の query 復元動作（category/userId）を統合テストで固定する。
