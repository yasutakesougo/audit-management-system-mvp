# Contract Guards — 設計契約の自動防御

> **目的**: 4モジュールの設計原則を CI で自動的に守る。
> **テストファイル**: [`tests/unit/contracts/contract.spec.ts`](../tests/unit/contracts/contract.spec.ts)

---

## 3つの Guard

| # | Guard | 検知内容 | CI動作 |
|---|-------|---------|--------|
| 1 | **SP直叩き防止** | `spClient` / `@pnp/sp` の `infra/` 外 import | ❌ fail |
| 2 | **型SSOT違反** | `domain/` 内の `schema.ts` 外での `export interface/type` | ❌ fail |
| 3 | **肥大化シグナル** | `*Orchestrator*` / `*Form.tsx` が 600行超 | ❌ fail |

## 適用対象 (HARDENED_MODULES)

```typescript
const HARDENED_MODULES = ['users', 'schedules', 'daily', 'attendance'];
```

新しいモジュールを硬化するには、この配列に追加するだけ。

---

## 例外の出し方 (opt-out)

コード内にコメントを書くと、そのファイルが該当 Guard から除外される。

| Guard | 注釈 | 用途 |
|-------|------|------|
| Guard 1 | `// contract:allow-sp-direct` | SP直叩きの一時許可 |
| Guard 2 | `// contract:allow-interface` | Repository契約など正当な interface |
| Guard 3 | `// contract:allow-large-file` | 分割予定の大型ファイル |

### opt-out ルール（3つだけ）

1. **理由を1行で必ず書く**（監査可能性）
2. **最小範囲・期限付き** を原則（可能なら Issue 番号併記）
3. **contract tests は増やしすぎない**（新ルール追加は「再発が起きた時」に限定）

---

## Guard 1: SP直叩き防止

**原則**: SharePoint アクセスは `infra/` 層の Repository 実装のみ。

**自動除外**:
- `infra/` — SP接続層
- `data/` — レガシーアダプタ（将来削除予定）
- `import type` — 型のみは runtime 結合なし

**現状のopt-out**: なし（ゼロ）

## Guard 2: 型SSOT違反

**原則**: ドメイン型の定義は `domain/schema.ts` に集約（Zod + `z.infer`）。

**正当な例外** (`contract:allow-interface` 付き):

| ファイル | 理由 |
|---------|------|
| `*Repository.ts` | Repository の振る舞い契約 |
| `*FormState.ts` | UI層の状態型 |
| `*Draft.ts` | UI層のドラフト型 |

## Guard 3: 肥大化シグナル

**原則**: Orchestrator / Form は 600行以内。超えたら logic + state hook + JSX に分割。

**分割パターン** (確立済み):

```
FooForm.tsx (600行超)
  → fooFormLogic.ts      (純粋関数・定数)
  → useFooFormState.ts   (state / handler / effect)
  → FooForm.tsx          (JSX合成のみ)
```

**現状のopt-out**: なし（ゼロ）

---

## よくある質問

**Q: 新しい feature module を作ったら？**
A: `HARDENED_MODULES` に追加する。CI が既存コードをスキャンするので、違反があれば即検知。

**Q: opt-out を消すタイミングは？**
A: Issue が立ったら。「一時的な例外」は放置しない文化を維持する。

**Q: Guard を新しく追加したい場合は？**
A: 「再発が起きた時」に限定。予防的に追加しすぎるとノイズになる。
