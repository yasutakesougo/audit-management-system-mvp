# Record Quality Review Observability

Record Quality Review の下書き作成を Daily record save 後に確認するための runbook。

この runbook は、レビュー下書きが安全に作られ、件数とスキップ理由を追える状態を運用契約として固定する。AI評価ロジック、現場画面の警告表示、Queue UI、SharePoint 診断は対象外とする。

## Daily save observability

`record-quality:daily-save` logs review draft creation counts after Daily record save.

- `createdReviewCount`
  - Number of new Record Quality Review draft records created.
- `skippedReviewCount`
  - Total number of skipped user rows.
  - Derivable from `emptyTextSkippedReviewCount + existingReviewSkippedReviewCount`.
- `emptyTextSkippedReviewCount`
  - Number of user rows skipped because no reviewable support text was present.
- `existingReviewSkippedReviewCount`
  - Number of user rows skipped because a review draft already existed.
- `userRowCount`
  - Number of user rows included in the Daily save operation.
- No original support record body is stored in logs or review metadata.

## Review Procedure

1. Save a Daily record.
2. Find the `record-quality:daily-save` log entry.
3. Confirm `userRowCount` matches the Daily save target user rows.
4. Confirm `createdReviewCount + skippedReviewCount` is explainable from the Daily save target rows.
5. Confirm logs and review metadata do not include original support record body text.

## Operational Contract

- `createdReviewCount` tracks new review drafts only.
- `skippedReviewCount` remains the aggregate skip count for compatibility.
- `emptyTextSkippedReviewCount` and `existingReviewSkippedReviewCount` are the skip reason counters.
- `userRowCount` is the denominator for Daily save review draft creation.
- Daily save must remain successful when a row is skipped for an empty review target or an existing review draft.
- Review metadata must reference the source support record by ID and must not copy the original body.

## Out of Scope

- Queue summary safety display.
- SharePoint diagnostics for the Record Quality Review persistence lane.
- AI evaluation or automatic support-record judgment.
- Field-screen warning display.
