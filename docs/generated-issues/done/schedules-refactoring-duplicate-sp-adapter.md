# sharePointAdapter.ts と SharePointScheduleRepository.ts のコード重複

- **対象ファイル**:
  - `src/features/schedules/data/sharePointAdapter.ts`（657行）
  - `src/features/schedules/infra/SharePointScheduleRepository.ts`（658行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  2 つのファイルが **ほぼ同一のコード** を含んでおり、合計 1,315 行のうち推定 400 行以上が重複しています。

  以下の関数・型が **完全に重複**:
  | 関数/型 | `sharePointAdapter.ts` | `SharePointScheduleRepository.ts` |
  |---|---|---|
  | `dayKeyInTz()` | L47-56 | L25-30 |
  | `monthKeyInTz()` | L58-67 | L32-38 |
  | `getHttpStatus()` | L17-31 | L40-54 |
  | `SharePointResponse` 型 | L81-83 | L56-58 |
  | `ScheduleFieldNames` 型 | L85-91 | L60-66 |
  | `resolveScheduleFieldNames()` | L93-110 | L68-85 |
  | `compact()` | L112-113 | L87-88 |
  | `buildSelectSets()` | L115-144 | L90-118 |
  | `readSpErrorMessage()` | L203-221 | L120-138 |
  | `toIsoWithoutZ()` | L325-332 | L140-143 |
  | `encodeDateLiteral()` | L343-352 | L145-153 |
  | `buildRangeFilter()` | L334-341 | L155-162 |
  | `isMissingFieldError()` | L354-360 | L164-170 |
  | `sortByStart()` | L362-363 | L172-173 |
  | `mapRepoSchedule…()` | L403-445 | L175-216 |
  | `generateRowKey()` | L447-457 | L218-227 |

  これはリファクタリング過程で旧実装（`sharePointAdapter.ts`）が残った状態です。どちらかにバグ修正を適用しても、もう一方に反映されないリスクがあります。
- **解決策の提案**:
  1. `SharePointScheduleRepository.ts` を正として統一
  2. 共通ユーティリティを `src/features/schedules/infra/scheduleSpUtils.ts` に抽出
  3. `sharePointAdapter.ts` を削除し、既存の参照を `SharePointScheduleRepository` に移行
  4. 移行後、`SharePointScheduleRepository.ts` を 400 行以下に削減

  ```
  src/features/schedules/infra/
  ├── SharePointScheduleRepository.ts  # メインリポジトリ (≤400行)
  ├── scheduleSpUtils.ts               # 共通ユーティリティ (≤100行)
  └── scheduleSpFieldConfig.ts         # フィールド名解決 (≤50行)
  ```
- **見積もり影響度**: High
