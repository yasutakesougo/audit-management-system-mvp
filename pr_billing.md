## Summary
- billing の Repository 内に埋もれていたデータ変換ロジックを domain/billingLogic.ts に抽出
- safeParseNumber と safeParseString を pure function 化し、不正入力からの防衛（NaNガード等）をカバー
- 請求（お金）領域の変換境界に対する強固な単体テスト網を展開

## Changes
- add: src/features/billing/domain/billingLogic.ts
- add: src/features/billing/domain/__tests__/billingLogic.spec.ts
- update: src/features/billing/sharepointRepository.ts

## Safety & Validation
- safeParseNumber における " 150 " 等の空白混入の許容と、"abc" / NaN / null に対する 0 へのフォールバックを確認・固定
- 負数 ("-1") の挙動は現状の Number.isFinite 評価によるパスを観測固定
- vitest: green
- tsc --noEmit: green
- eslint: green
