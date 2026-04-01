# Repository Access Standard (DI Guardrails)

## 🎯 目的
`DataProvider` (IDataProvider) の未注入による実行時エラー（#1353 等）を未然に防ぎ、レイヤー間の依存関係を清潔に保つ。

---

## 🚫 禁止事項
UIコンポーネント、または一般的な React Hook から **Repository Factory を直接呼び出すことを禁止** します。

```ts
// ❌ 埋め込まれた依存関係（DI不全の原因）
const repo = createIspDecisionRepository(); 
```

---

## ✅ 推奨パターン
常に `useXXXRepository()` フックを経由して取得してください。

```ts
// ✅ 正規ルート（DataProvider が自動的に注入される）
const repo = useIspDecisionRepository();
```

---

## 🛠 自動検知メカニズム (Guardrails)

### 1. ESLint Check (静的解析)
`.eslintrc.cjs` にて、UI層からの `create.*Repository` 呼び出しを制限しています。

```json
{
  "selector": "CallExpression[callee.name=/^create.*Repository$/]",
  "message": "Repository Factory を直接呼び出さないでください。useXXXRepository() を使用してください。"
}
```

### 2. Runtime Assertion (実行時チェック)
Factory 関数内では `provider` の存在を確認し、欠落している場合は即座にエラーをスローします。

```ts
if (!provider) {
  throw new Error('[XXXRepository] provider is required. Did you use the hook?');
}
```

---

## 🔄 移行ガイド

### 新規 Repository 作成時
1. `getXXXRepository(provider)` を定義する。
2. `useXXXRepository()` Hook をエクスポートし、内部で `useDataProvider()` を呼ぶ。
3. `createXXXRepository(provider?)` はテスト用または互換性のために残すが、プロダクションコードからは呼ばない。

### 既存コードの修正
1. `useMemo(() => createXXXRepository(), [])` を `useXXXRepository()` に書き換える。
2. 内部で `provider` が空の Factory 呼び出しを見つけたら、Hook 化を検討する。
