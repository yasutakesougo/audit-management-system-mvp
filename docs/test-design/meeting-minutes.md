# test design: meeting-minutes

> 対象: `src/features/meeting-minutes/`  
> 更新: 2026-03-18

---

## 1. scope

| 層 | 対象ファイル | 責務 |
|----|-------------|------|
| 型定義 | `types.ts` | `MeetingMinutes` / `MeetingCategory` |
| リポジトリ I/F | `sp/repository.ts` | `MeetingMinutesRepository` ポートインターフェース |
| ローカル実装 | `sp/localStorageRepository.ts` | localStorage CRUD + `matchesSearch` フィルタ |
| SP 実装 | `sp/sharepointRepository.ts` | REST fetch + `mapItemToMinutes` + `buildFilter` |
| UI | `components/MeetingMinutesForm.tsx` | 作成・編集フォーム |
| UI | `components/DailyMeetingExtension.tsx` | 朝会・夕会専用拡張フォーム |

テスト対象外（今回）: `pages/` (Route レベル)

---

## 2. critical flows

```
1. 議事録一覧取得
   MinutesSearchParams → repository.list() → MeetingMinutes[]

2. フィルタ（複合条件）
   q / tag / category / from / to / publishedOnly の組み合わせ

3. 議事録作成
   MeetingMinutesCreateDto → create() → id: number

4. 議事録更新
   id + MeetingMinutesUpdateDto → update() → void

5. id 未存在時のエラー
   getById(999) → Error thrown

6. SP マッパー
   SpItem → mapItemToMinutes → MeetingMinutes
   （attendees は JSON.parse / 生配列 の2パターン）
```

---

## 3. risk points

| # | リスク | 説明 |
|---|--------|------|
| R1 | matchesSearch の OR 漏れ | `q` 検索は title / summary / tags の3フィールドを対象。1つでも抜けると検索漏れ |
| R2 | attendees の JSON 解析失敗 | SP の複数行テキストが JSON.parse に失敗するとサイレントに `[]` になる（try/catch で握りつぶし） |
| R3 | meetingDate の境界比較 | `from` / `to` は文字列 `<` / `>` で比較。YYYY-MM-DD フォーマット前提なので、フォーマット崩れで誤フィルタの可能性 |
| R4 | nextId の衝突 | `Math.max(...items.map(i => i.id)) + 1` は空配列で `-Infinity + 1 = NaN` にならない（0 に分岐済みだが確認要） |
| R5 | SP のフィルタ OData 生成 | `buildFilter` が長くなると SP 側で 400 返すリスク。文字列 encode / escape が不十分だと XSS に近い問題にもなる |
| R6 | spFetch 未移行（Issue 1） | ネイティブ `fetch` を使っているため、`no-restricted-globals` を抑制中。認証ヘッダーの漏れや env 差異のリスクあり |
| R7 | isPublished のデフォルト | `create` 時に `isPublished` が未指定の場合、SP 実装は `true` を明示的にセット。local 実装は `draft.isPublished` をそのまま使う → 実装差異 |

---

## 4. recommended test layers

### Layer A — `matchesSearch` 純関数 (Vitest, 最優先)

```
localStorage 実装の中核ロジックで副作用なし。
組み合わせが多いため、境界値を網羅しやすい。
```

### Layer B — `mapItemToMinutes` 純関数 (Vitest)

```
attendees の JSON/配列二重対応が複雑なので必須。
SP 境界の型変換を守る役割。
```

### Layer C — `buildFilter` 純関数 (Vitest)

```
OData フィルタ文字列の組み立てロジック。
条件が増えるほど崩れやすいので文字列アサーションで守る。
```

### Layer D — LocalStorage Repository (Vitest + localStorage mock)

```
create → list で取得できること
update → 変更が反映されること
getById → 存在しない id で throw されること
```

---

## 5. first test targets（実装候補 Top5）

```typescript
// Target: sp/localStorageRepository.ts の matchesSearch

// T1: q 検索 — title にヒット
it('should match when query is found in title', () => {
  const item = makeMinutes({ title: '職員会議 議事録' });
  expect(matchesSearch(item, { q: '職員会議' })).toBe(true);
});

// T2: q 検索 — 全フィールドミス
it('should not match when query is not in title/summary/tags', () => {
  const item = makeMinutes({ title: 'A', summary: 'B', tags: 'C' });
  expect(matchesSearch(item, { q: 'Z' })).toBe(false);
});

// T3: from/to 境界 — 境界日当日は含む
it('should include meeting on boundary date (from)', () => {
  const item = makeMinutes({ meetingDate: '2026-03-01' });
  expect(matchesSearch(item, { from: '2026-03-01' })).toBe(true);
});

// T4: attendees の JSON パース失敗時のフォールバック (mapItemToMinutes)
it('should return empty attendees array when JSON parse fails', () => {
  const item: SpItem = { [F.attendees]: 'not-json' };
  const result = mapItemToMinutes(item);
  expect(result.attendees).toEqual([]);
});

// T5: nextId — 空配列の場合は 1 を返す
it('should return 1 as the first id when no items exist', () => {
  expect(nextId([])).toBe(1);
});
```

---

## 6. テストピラミッド（meeting-minutes 全体）

| 層 | 対象 | 件数目安 | ツール |
|----|------|:-------:|--------|
| Unit | `matchesSearch`, `mapItemToMinutes`, `buildFilter`, `nextId` | 15〜20件 | Vitest |
| Integration | LocalStorage repository CRUD | 5〜8件 | Vitest + `localStorage` mock |
| Integration | SP repository (fetch mock) | 3〜5件 | Vitest + `vi.fn()` |
| E2E | 作成→一覧→詳細フロー | 1〜2件 | Playwright |

---

## 6. deferred

| 項目 | 理由 |
|------|------|
| SP repository の fetch mock テスト | spFetch 移行 (Issue 1) 完了後に実施するのが合理的 |
| MeetingMinutesForm の UI テスト | フォームが大きく変更頻度が高い。安定後に |
| DailyMeetingExtension | 朝会・夕会の拡張UI。基本導線が先 |
| isPublished の実装差異テスト | SP / local 実装の整合を確認。Issue 1 完了と合わせて |

---

## 補足: テストヘルパー共通化の提案

3 feature で繰り返し使うので、以下を `src/__tests__/factories/` に置くと効率良い。

```typescript
// factories/meetingMinutesFactory.ts
export function makeMinutes(overrides?: Partial<MeetingMinutes>): MeetingMinutes {
  return {
    id: 1,
    title: 'Test Meeting',
    meetingDate: '2026-01-15',
    category: '職員会議',
    summary: '', decisions: '', actions: '', tags: '', relatedLinks: '',
    isPublished: true,
    ...overrides,
  };
}
```
