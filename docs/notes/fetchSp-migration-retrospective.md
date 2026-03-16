# fetchSp → spFetch Migration Retrospective

> **Date**: 2026-03-16
> **Scope**: SharePoint API access layer
> **PR**: #998, #999
> **Phase**: 3-C (final)

---

## 背景

本プロジェクトでは SharePoint API 呼び出しが以下の 2 系統で存在していた。

| 系統 | ファイル | 特徴 |
|------|---------|------|
| `fetchSp` (旧) | `src/lib/fetchSp.ts` | 生 Response 返却、手動 `response.ok` チェック |
| `spFetch` (新) | `src/lib/sp/spFetch.ts` | `throwOnError` デフォルト、リトライ・mock・監査対応 |

これにより以下の問題が顕在化していた。

- **通信経路の分散** — 同じ SharePoint API でも呼び出し方が 2 種類
- **エラーハンドリングの不統一** — `response.ok` 手動チェック vs 自動 throw
- **品質の格差** — リトライ・トークン更新・mock 注入が `fetchSp` 側に効かない
- **保守コスト** — 修正時に 2 系統を意識する必要がある

---

## 目的

SharePoint 通信を **`spClient` / `spFetch` に一本化** し、
API アクセスの標準基盤を確立する。

---

## 実施したステップ

今回の移行は以下の **7 ステップ** で段階的に行った。

```
1. 全量調査        — fetchSp の利用箇所を網羅的に特定
2. 正規出口の決定  — spClient / spFetch を唯一の通信手段として定義
3. 互換レイヤー    — fetchSp 内部を spFetch に委譲 (Phase 3-A)
4. 新規流入の凍結  — ESLint no-restricted-imports で fetchSp import 禁止 (Phase 3-B)
5. テンプレート作成 — 移行手順を fetch-client-guideline.md に文書化
6. 段階移行        — 7 箇所を 1 つずつ spClient DI に移行 (Phase 3-C)
7. 旧コード削除    — fetchSp.ts を削除、参照 0 を確認
```

この順序が重要で、**互換レイヤー → 凍結 → 段階移行** により
一度も既存機能を壊すことなく移行を完了している。

---

## 移行対象 (全 7 箇所)

| モジュール | ファイル | 用途 |
|-----------|---------|------|
| admin | `DataIntegrityPage.tsx` | データ整合性チェック |
| monitoring | `SharePointIspDecisionRepository.ts` | ISP 判断レコード |
| monitoring | `SharePointSupportPlanningSheetRepository.ts` | 計画書シート |
| daily | `SharePointDailyRecordRepository.ts` | 日次記録 CRUD |
| schedules | `SharePointScheduleRepository.ts` | スケジュール Repository |
| schedules | `scheduleSpHelpers.ts` | スケジュール SP ヘルパー |
| support-plan-guide | `SharePointSupportPlanDraftRepository.ts` | 支援計画ドラフト |

---

## 結果

- ✅ `fetchSp.ts` **削除**
- ✅ ソースコード内の `fetchSp` 参照 **0**
- ✅ TypeScript / ESLint / テスト **全通過**
- ✅ SharePoint 通信は **`spClient` / `spFetch` のみ**

---

## 設計上の改善

### 1. 通信基盤の統一

SharePoint API 呼び出しが単一の経路に統一された。

```
呼び出し元 → Repository → spFetch() → fetch()
                              ↑
                         リトライ / トークン更新 / mock / 監査ログ
```

すべての通信が同じ品質基盤に乗るため、
一時的な API 失敗・認証切れ・開発環境での挙動差異が解消された。

### 2. エラーハンドリングの責務分離

```
HTTP エラー  → spFetch が処理 (throwOnError: true)
業務例外    → Repository が処理
```

| Repository | ケース | 処理 |
|-----------|-------|------|
| `deleteDraft` | 404 | 冪等削除として成功扱い |
| `findByDraftId` | 404 | `null` 返却 |
| `checkListExists` | HTTP エラー | `false` 返却 |
| その他 | HTTP エラー | `SpHttpError` を上位に伝播 |

「通信エラー」と「業務上の意味」の境界が明確になった。

### 3. Repository 責務の純化

移行前は Repository ごとに以下がバラバラだった。

- `fetchSp` 直呼び / `createSpClient` 部分利用 / `getClient()` 死コード
- `baseUrl` 前提の絶対パス / 相対パス
- シングルトン export / ファクトリー関数

移行後は全 Repository が統一されたパターンに従う。

```typescript
class SomeRepository {
  constructor(
    private spFetch: SpFetchFn,   // DI で注入
    private baseUrl: string,
  ) {}

  async someMethod(): Promise<T> {
    const res = await this.spFetch('/_api/web/lists/...');  // 相対パス
    return mapToEntity(res);  // 業務変換のみ
  }
}
```

---

## 再発防止策

| 対策 | 内容 |
|------|------|
| ESLint | `no-restricted-imports` で `@/lib/fetchSp` を禁止（ルール現存） |
| ガイドライン | `docs/guides/fetch-client-guideline.md` に正規ルートと禁止パターンを明記 |
| ファイル削除 | `fetchSp.ts` 自体が存在しないため、import 不可能 |

---

## 学び: 技術的負債の安全な返済パターン

今回確立したパターンは以下の通り。

```
┌─────────────────────────────────────────────────┐
│  1. 全量調査        — 影響範囲を正確に把握       │
│  2. 正規出口決定    — 唯一の正しい方法を定義     │
│  3. 互換レイヤー    — 旧→新を内部で委譲          │
│  4. 新規流入凍結    — ESLint や CI で新規利用阻止 │
│  5. テンプレート化  — 移行手順を標準化           │
│  6. 段階移行        — 1箇所ずつ安全に移行        │
│  7. 削除            — 旧コードを物理的に除去     │
└─────────────────────────────────────────────────┘
```

**核心**: 互換レイヤーと凍結を先に入れることで、
移行中も既存機能を壊さず、かつ新たな負債の蓄積を防げる。

---

## 横展開の候補

このパターンは以下の整理にもそのまま適用可能。

| 対象 | 正規出口 | 凍結方法 |
|------|---------|---------|
| `window.alert` / `confirm` | `useAlertDialog` / toast | ESLint `no-restricted-globals` |
| `localStorage` 直アクセス | `useStorage` hook | ESLint `no-restricted-properties` |
| 生 `console.log` | `auditLog` | ESLint `no-console` |
| Graph API 直呼び出し | `graphFetch` | ESLint `no-restricted-imports` |

---

## 関連ドキュメント

- [fetch-client-guideline.md](../guides/fetch-client-guideline.md) — 通信クライアントの使い方
- [SharePoint Client Architecture KI](../../src/lib/sp/) — spClient の設計
