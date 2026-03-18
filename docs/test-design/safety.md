# test design: safety

> 対象: `src/features/safety/` + `src/domain/safety/` + `src/domain/support/incidentRepository.ts`  
> 更新: 2026-03-18

---

## 1. scope

| 層 | 対象ファイル | 責務 |
|----|-------------|------|
| ドメイン純関数 | `domain/safety/physicalRestraint.ts` | `computeRestraintSummary`, `computeDurationMinutes` |
| ドメイン純関数 | `domain/safety/complianceCommittee.ts` | `computeCommitteeSummary` |
| ドメイン純関数 | `domain/safety/guidelineVersion.ts` | `computeGuidelineSummary` |
| ドメイン純関数 | `domain/safety/trainingRecord.ts` | `computeTrainingSummary`, `computeAttendanceRate` |
| ドメイン純関数 | `domain/support/incidentRepository.ts` | `computeIncidentSummary` |
| フック | `features/safety/hooks/useSafetyOperationsSummary.ts` | 5リポジトリを並列 fetch → overallLevel 判定 |
| UI | `features/safety/components/SafetyOperationsSummaryCard.tsx` | summary カード表示 |

テスト対象外（今回）: Dialog 系コンポーネント（入力フォーム）

---

## 2. critical flows

```
1. サマリ集計
   [incidents, restraints, committees, guidelines, trainings]
    → computeXxxSummary × 5
    → actionRequiredCount の積算
    → overallLevel ('good' | 'warning' | 'critical') の判定

2. critical 判定ルール（最重要）
   incidentSummary.pendingFollowUp > 0    → critical
   restraintSummary.pendingApproval > 0   → critical
   restraintSummary.incompleteRequirements > 0 → critical

3. warning 判定ルール
   !committeeSummary.meetsQuarterlyRequirement → warning
   !guidelineSummary.allItemsFulfilled         → warning
   !trainingSummary.meetsBiannualRequirement   → warning

4. 身体拘束の期間算出
   startedAt / endedAt → computeDurationMinutes → number

5. 研修出席率
   participants[] → computeAttendanceRate → 0-100%
```

---

## 3. risk points

| # | リスク | 説明 |
|---|--------|------|
| R1 | overallLevel の優先順位 | critical > warning > good。この順序が壊れると、要対応なのに 'good' と表示される可能性 |
| R2 | actionRequiredCount の二重カウント | restraint の `pendingApproval` と `incompleteRequirements` は独立加算。集計ロジックが変わると監査書類と数値が合わなくなる |
| R3 | meetsQuarterlyRequirement の境界 | 四半期に1回の開催要件。実装は「会計年度（4/1〜3/31）内の開催回数 ≥ 4」で判定。3月31日の記録は前年度扱いになる点が注意境界。 |
| R4 | meetsBiannualRequirement の境界 | 年2回。実装は「会計年度内の completed 研修 ≥ 2」で判定。cancelled / planned はカウント外。 |
| R5 | computeDurationMinutes の負の値 | endedAt < startedAt の場合、負の分数を返す可能性 |
| R6 | 全リポジトリ並列 Promise.all | 1つでもリポジトリ失敗すると全summary失敗。エラー状態が loading のまま固まるリスク |
| R7 | localStorage 依存 | 実装が localStorage に直結しており、環境依存のテストになりやすい |

---

## 4. recommended test layers

### Layer A — Pure Functions (Vitest, 最優先)

対象: `computeXxxSummary` 5関数 + `computeDurationMinutes`

```
制度ルール系（障害福祉は制度要件が厳格）:
- meetsQuarterlyRequirement の境界（91日 / 90日 / 89日）
- meetsBiannualRequirement の境界（183日 / 181日）
- pendingFollowUp > 0 の集計

数値計算:
- computeDurationMinutes: 正常 / endedAt < startedAt / 日またぎ
- computeAttendanceRate: 全員出席 / 全員欠席 / 空配列
```

### Layer B — overallLevel 判定 (Vitest)

対象: `useSafetyOperationsSummary` 内のレベル判定ロジックを純関数に切り出してテスト  
（現状はフック内に埋め込みだが、切り出しが望ましい）

```
- all good → 'good'
- committee not meeting → 'warning'
- pendingFollowUp > 0 → 'critical' (warning があっても critical が優先)
```

### Layer C — Hook (Vitest + renderHook + localStorage mock)

```
- loadData 成功時: summary が null → populated に変わる
- loadData 失敗時: loading が false に戻り summary は null のまま
- reload() 呼び出し: 再取得される
```

---

## 5. first test targets（実装候補 Top5）

```typescript
// T1: overallLevel — critical が warning より優先される
it('should return critical when pendingFollowUp > 0 even if warning conditions also exist', () => {
  // incidentSummary.pendingFollowUp = 1
  // committeeSummary.meetsQuarterlyRequirement = false (→ warning のはず)
  // 期待: overallLevel === 'critical'
});

// T2: computeDurationMinutes — 通常ケース
it('should compute duration in minutes correctly', () => {
  expect(computeDurationMinutes('2026-03-18T10:00:00', '2026-03-18T10:30:00')).toBe(30);
});

// T3: computeDurationMinutes — endedAt が startedAt より前
it('should return negative duration when endedAt precedes startedAt', () => {
  // この場合の想定挙動を明確にする（0 or 負数 or throw）
  expect(computeDurationMinutes('2026-03-18T11:00:00', '2026-03-18T10:00:00')).toBeLessThanOrEqual(0);
});

// T4: computeCommitteeSummary — meetsQuarterlyRequirement の境界
it('should meet quarterly requirement when latest meeting is within 90 days', () => {
  // today: 2026-03-18, latest: 2025-12-18 (90 days prior) → 境界値
});

// T5: computeAttendanceRate — 空配列
it('should return 0 when participants array is empty', () => {
  expect(computeAttendanceRate([])).toBe(0);
});
```

---

## 6. deferred

| 項目 | 理由 |
|------|------|
| RestraintRecordDialog | 入力フォームが大きく、UI 変更頻度が高い |
| IncidentHistoryList の UI | データ表示のみなので壊れにくい |
| E2E: 身体拘束申請フロー | 承認フロー含め複雑。設計が固まってから |
| localStorage 境界テスト | `localRestraintRepository` 等は localStorage.setItem をモックする必要あり |

---

## 補足: overallLevel 純関数の切り出し提案

現在 `useSafetyOperationsSummary.ts` のフック内に overallLevel 判定ロジックが埋まっている。  
これを以下のように切り出すと Layer A でテスト可能になる。

```typescript
// 推奨: domain/safety/safetyLevel.ts
export function computeOverallLevel(
  incident: IncidentSummary,
  restraint: RestraintSummary,
  committee: CommitteeSummary,
  guideline: GuidelineSummary,
  training: TrainingSummary,
): SafetyOperationsSummary['overallLevel'] { ... }
```

> [!NOTE]
> 切り出しは `/refactor` ではなくテスト実装時に合わせて行うのが現実的。
