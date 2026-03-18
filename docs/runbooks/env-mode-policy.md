# Environment Mode Policy

This document defines the single source of truth for switching the application's data source mode (SharePoint vs Local Mock).

## Mode Policy

* `VITE_SP_ENABLED=true` の場合のみ、Monitoring / Planning 系の repository は `sharepoint` モードを使用する
* `VITE_SP_ENABLED` が未設定、`false`、その他の値である場合は、`local` モードを使用する
* `local` モードは localStorage / mock ベースの開発・検証用であり、MSAL 認証を必要としない
* `sharepoint` モードは SharePoint への実接続を行い、MSAL 認証を必要とする
* 認証スキップやデモ表示に関する他フラグ（`IS_DEMO`, `IS_SKIP_LOGIN`, etc.）は、repository モード判定には使用しない

---

## 運用パターンと動作の対応表

| 環境 | `VITE_SP_ENABLED` の値 | 適用モード | MSAL 認証 | 用途 |
|---|---|---|---|---|
| **Local 開発** | **未設定 （または false）** | `local` | **不要** (Mock / localStorage) | 日々の UI・機能実装、高速なローカル開発 |
| **SP 接続検証** | `true` | `sharepoint` | **必須** | SPとのつなぎ込み確認、データ整合性テスト |
| **本番 (Prod)** | `true` | `sharepoint` | **必須** | サポート計画シート等の本番運用 |

---

## 実装上の注意点

`src/lib/env.ts` では、Vite の環境変数 (`VITE_SP_ENABLED`) を文字列の厳密な比較で評価し、モードを決定しています。

```ts
// src/lib/env.ts — 実装は env.ts を参照
export const SP_ENABLED = /* VITE_SP_ENABLED === 'true' */;
export const SP_DISABLED = !SP_ENABLED;
```

* `'1'`, `'yes'`, `'TRUE'` などの曖昧な値はすべて `false` としてフォールバックし、意図せず SharePoint の本番環境に繋がってしまう事故を防ぎます。
* アプリケーションが提供するRepository Factory (`createXYZRepository` など) やUI層では、必ずこの `SP_ENABLED` 定数を参照し、3項演算子等でシンプルに分岐を行ってください。
