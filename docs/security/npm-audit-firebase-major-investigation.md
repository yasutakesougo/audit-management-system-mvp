# Firebase major update investigation (npm audit)

## Scope
- docs-only
- `npm audit --omit=dev` の結果を基に、`firebase` の major 更新方針を分離する
- 実装変更・依存更新・lockfile 更新は対象外

## 実行日時
- 2026-07-08

## 確認コマンド
```bash
npm ls firebase --depth=0
npm audit --omit=dev --json > %TEMP%\npm-audit-omit-dev-firebase.json
npm audit --omit=dev
```

## 現在値（確認結果）
- `npm ls firebase --depth=0`
  - `firebase@10.14.1`
- `npm audit --omit=dev`（直近結果）
  - `firebase`：
    - installed: `10.14.1`
    - severity: `moderate`
    - advisory: undici 系（`GHSA-c76h-2ccp-4975` ほか）
    - `fixAvailable`: `yes`
    - `isSemVerMajor`: `true`（major update required）
    - runtime impact: `yes`（認証/データ系として直接利用）
  - 依存鎖として `undici` 由来も指摘あり（firebase 経由）

## 方針
- 本 PR では `firebase` の直接更新は行わず、次PRで分離して実施
- 互換性影響の大きい経路（認証・Firestore/Storage 連携、設定・初期化周り）を次PRで切り出し調査
- 本件は `app code` / `CI workflow` の同時変更とは分離

## 次PR候補（本PRから分離）
1. firebase major update impact review（認証/データ系）
2. `undici` 影響分離（firebase 側での置換可能性評価）
3. CI / E2E での `AUTH_REQUIRED` 系差分確認を `secret lane` と切り分けたうえで再検証

## 補足
- 依存バージョン更新はしないため `package.json` / `package-lock.json` は変更しない
- JSON監査結果は `%TEMP%\npm-audit-omit-dev-firebase.json` に保存して監査証跡とする
