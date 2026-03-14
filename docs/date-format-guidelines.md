# Date Format Guidelines

> このドキュメントは、`src/lib/dateFormat.ts` の統合 API を使った
> 日付整形の標準ルールを定めます。
> Issue #911 (Phase 1–4) で整備。

---

## 1. 原則

### ✅ 使うべきもの

- **新規コードでは `src/lib/dateFormat.ts` を最優先で利用する**
- 共通 API で表現できるフォーマットは、ローカル実装を作らない
- 既存 wrapper は段階的に削減する（新規作成は原則禁止）

### ❌ 避けるべきもの

| パターン | 代わりに |
|---|---|
| `new Date(x).toLocaleDateString('ja-JP')` | `formatDateTimeIntl(x, options)` |
| `new Date(x).toLocaleDateString('ja-JP', { year, month, day })` | `formatDateYmd(x)` or `formatDateTimeIntl(x, opts)` |
| `date.toISOString().slice(0, 10)` | `formatDateIso(date)` |
| 手動の `` `${y}/${m}/${d}` `` 組み立て | `formatDateYmd(date)` |
| 手動の `` `${y}年${m}月${d}日` `` 組み立て | `formatDateJapanese(date)` |
| 手動の `` `${y}-${m}-${d}` `` 組み立て | `formatDateIso(date)` |

---

## 2. API 使い分け

### `formatDateYmd(input)`
- **出力**: `YYYY/MM/DD` (ゼロ埋め)
- **用途**: 表示用の標準日付（テーブル、ラベル、tooltip）
- **例**: `formatDateYmd(new Date(2026, 2, 14))` → `'2026/03/14'`
- **null/undefined**: `''` を返す

### `formatDateJapanese(input)`
- **出力**: `YYYY年M月D日` (ゼロ埋めなし)
- **用途**: 日本語表記が求められる UI 表示
- **例**: `formatDateJapanese('2026-03-05')` → `'2026年3月5日'`
- **null/undefined**: `''` を返す

### `formatDateIso(input)`
- **出力**: `YYYY-MM-DD` (ゼロ埋め)
- **用途**: 内部キー、URL パラメータ、データ比較、InMemory シード
- **例**: `formatDateIso(new Date(2026, 2, 14))` → `'2026-03-14'`
- **null/undefined**: `''` を返す

### `formatDateTimeYmdHm(input)`
- **出力**: `YYYY/MM/DD HH:mm`
- **用途**: 日時表示（タイムスタンプ、ログ）
- **例**: `formatDateTimeYmdHm(new Date())` → `'2026/03/14 01:30'`
- **null/undefined**: `''` を返す

### `formatDateTimeIntl(input, options)`
- **出力**: `Intl.DateTimeFormat('ja-JP', options)` による locale 依存表示
- **用途**: `toLocaleDateString` の安全な代替
- **例**: `formatDateTimeIntl(date, { year: 'numeric', month: '2-digit', day: '2-digit' })`
- **null/undefined**: `''` を返す
- **注意**: `month: 'short'` や `weekday: 'long'` はブラウザ依存の出力になる

### `safeFormatDate(input, formatter, fallback?)`
- **出力**: `formatter(date)` の結果、parse 失敗時は `fallback`
- **用途**: 上記 API でカバーできないカスタム表示（曜日付き、相対時間など）
- **例**:
  ```typescript
  const DAYS = ['日','月','火','水','木','金','土'];
  safeFormatDate(dateStr, (d) => `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]})`, dateStr);
  ```
- **注意**: カスタムフォーマッターが頻出するなら `dateFormat.ts` への追加を検討

### `toSafeDate(input)`
- **出力**: `Date | null`
- **用途**: parse のみ。表示は行わない。バリデーション用
- **例**: `toSafeDate('2026-03-14')` → `Date`、`toSafeDate('invalid')` → `null`

---

## 3. 禁止/注意領域

以下の領域では `dateFormat.ts` を安易に使わないでください。

| 領域 | 理由 | 対応 |
|---|---|---|
| `domain/` | ドメインロジックの日付表現は仕様に依存 | 個別確認 |
| `repository interface` | 永続化フォーマットが外部仕様に依存 | 変更禁止 |
| `sharepoint/` | SharePoint API のフォーマット制約 | 変更禁止 |
| PDF / Excel / レポート出力 | 帳票レイアウトとの厳密一致が必要 | E2E テスト必須 |
| audit log | 監査証跡の形式変更は規制リスク | 変更禁止 |
| timezone 変換 (`date-fns-tz`) | TZ 演算と表示は責務が異なる | 分離維持 |
| billing / 報酬算定 | 制度上の日付表現 | 変更禁止 |
| HTML `<input type="date">` | ブラウザ API の要求形式 | そのまま維持 |

---

## 4. wrapper について

### wrapper を許可する条件
- デフォルト引数が必要（例: `formatDateLocal(d = new Date())`）
- ドメイン固有の fallback がある（例: `'未設定'` を返す）
- カスタム表示パターンが semantic name として価値がある

### wrapper を許可しない条件
- 単に共通 API を呼ぶだけの 1 行関数
- 呼び出し元が 1–2 箇所で、直接呼び出しで十分
- 名前が一般的すぎて意味が伝わらない
  （例: `formatDate` → `formatDateYmd` のほうが明確）

### 既存 wrapper の段階削減ルール
1. `@deprecated` アノテーション済みの wrapper は、呼び出し元を1つずつ直接呼び出しに変更してよい
2. 呼び出し元が 0 になったら wrapper を削除する
3. 外部ファイルからの import がある wrapper は、import 元の変更も必要
4. テストファイルの wrapper 参照も同時に更新する

---

## 5. PR レビュー時の確認観点

新規コードのレビュー時に以下を確認してください。

- [ ] `toLocaleDateString()` の直書きがないか
- [ ] 手動の日付文字列組み立てがないか
- [ ] `dateFormat.ts` の API で代替可能な実装がないか
- [ ] 新しい wrapper を不要に作っていないか
- [ ] timezone 変換と表示を混同していないか
- [ ] null/undefined/invalid のハンドリングが適切か

---

## 6. API 一覧 (Quick Reference)

```typescript
import {
  formatDateYmd,        // → 'YYYY/MM/DD'
  formatDateJapanese,   // → 'YYYY年M月D日'
  formatDateIso,        // → 'YYYY-MM-DD'
  formatDateTimeYmdHm,  // → 'YYYY/MM/DD HH:mm'
  formatDateTimeIntl,   // → Intl.DateTimeFormat
  safeFormatDate,       // → custom formatter
  toSafeDate,           // → Date | null
} from '@/lib/dateFormat';
```
