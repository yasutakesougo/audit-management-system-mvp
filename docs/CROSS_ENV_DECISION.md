# HOOK_TIMEOUT 環境変数参照：クロスプラットフォーム対応の検討

## 現在の実装

```json
"test:ci": "cross-env-shell \"vitest run ... --hookTimeout=\\${HOOK_TIMEOUT:-10000}\""
```

## 背景

`npm script` での環境変数展開は、**実行シェル環境に依存**します：

| 環境 | 変数展開 | 状態 |
|-----|--------|------|
| macOS/Linux (bash/zsh) | `${VAR:-default}` ✅ | 現在OK |
| Windows (cmd.exe) | `%VAR%` | ❌ 非互換 |
| Windows (PowerShell) | `$env:VAR` | ❌ 非互換 |
| GitHub Actions (Linux) | `${VAR:-default}` ✅ | 現在OK |

## オプション A：現状維持（推奨：チームが macOS/Linux のみ）

**メリット：**
- 追加依存なし
- npm 7.0+ 標準対応
- 軽い

**デメリット：**
- Windows 非対応
- WSL 導入時に問題の可能性

**判断：** ✅ チーム OS が固定なら十分

---

## オプション B：cross-env-shell で統一（推奨：Windows 対応が必要）

**メリット：**
- Windows/macOS/Linux すべて対応
- npm script のシェル展開を npm が吸収
- プロジェクト既に `cross-env` 知見あり（playwright.config.ts で参照）

**実装：**
```bash
npm install -D cross-env
```

```json
"test:ci": "cross-env-shell \"vitest run ... --hookTimeout=\\${HOOK_TIMEOUT:-10000}\""
```

**デメリット：**
- 追加依存（~5KB）
- 全チームに npm install 強要

---

## オプション C：Node.js スクリプト経由（推奨：複数の env 参照が増える場合）

環境変数が増える見込みなら、シェル依存を排除：

```json
"test:ci": "node scripts/run-test-ci.mjs"
```

```javascript
// scripts/run-test-ci.mjs
import { execSync } from 'child_process';

const hookTimeout = process.env.HOOK_TIMEOUT ?? '10000';
const cmd = `vitest run --run --reporter=verbose --no-file-parallelism --pool=forks --maxWorkers=1 --hookTimeout=${hookTimeout}`;

try {
  execSync(cmd, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 1);
}
```

**メリット：**
- 完全にクロスプラットフォーム
- Node.js だけで完結
- スクリプト内にロジック記述可能

**デメリット：**
- ファイル追加

---

## 現在の状態

✅ `cross-env-shell` に更新済み（`package.json` の `test:ci`）

**次のステップ：**

1. **チーム構成が明確なら** → オプション A/B のいずれかに決定
2. **今は曖昧なら** → オプション A（現状維持）で OK → 将来問題が出たら B/C 検討
3. **Windows/WSL 導入予定が明白なら** → オプション B（`npm install -D cross-env`）を実行

---

## 推奨判断フロー

```
チーム構成確認
  ├─ macOS/Linux のみ固定
  │   └─ ✅ 現状維持（オプション A）
  │
  ├─ Windows が混じる（可能性含む）
  │   └─ ✅ cross-env install（オプション B）
  │
  └─ 将来的に env が増える見込み
      └─ 💭 Node.js スクリプト検討（オプション C）
```

---

## 補足：cross-env-shell の動作

```bash
cross-env-shell "echo ${MY_VAR:-default}"
```

- `cross-env-shell` が正しいシェル（bash/cmd/powershell）を自動選択
- npm script 内の Bash 変数展開を Node.js 層で吸収
- 結果的に Windows でも `${VAR:-default}` 構文が動く

---

## Decision Log

| 判断 | タイミング | 理由 |
|-----|--------|------|
| `cross-env-shell` に更新 | 2026-01-21 最終盤石化 | Windows 対応の可能性を事前潰し |
| `npm install -D cross-env` は実行 **待機** | TBD | チーム OS 構成の確認が先 |
