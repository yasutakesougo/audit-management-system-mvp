# @blocknote major update investigation (npm audit)

- Scope: `npm audit --omit=dev` の結果から `@blocknote` 系の major 更新要否を棚卸しする。
- App / CI / lockfile / package.json は本PRで変更しない。
- 依存更新は次PRで分離実施する。

## 実行証跡

- `npm ls @blocknote/core --depth=0`
  - `@blocknote/core@0.47.3`
- `npm ls @blocknote/mantine --depth=0`
  - `@blocknote/mantine@0.47.3`
- `npm ls @blocknote/react --depth=0`
  - `@blocknote/react@0.47.3`
- `npm audit --omit=dev --json > %TEMP%\npm-audit-omit-dev-blocknote.json`
  - 監査出力は証跡として保存済み

## 分類

- `@blocknote` 系は `npm audit --omit=dev` で medium 脆弱性の検知があり、
  `fix available` は `yes` かつ `major update`（`0.51.4` 予定）領域として扱う。
- 依存鎖として `uuid <11.1.1` と uuid CVE（moderate）が `@blocknote/core` 経由で顕在化。
- `xlsx` 連鎖を分離済みの前提で扱うため、`@blocknote` は別 PR で影響評価。

## 現状判断（このPR）

1. `@blocknote` direct fix は本PRでは未実施。
2. `firebase` / `xlsx` / `lockfile` / アプリ実装には触らない。
3. `@blocknote` major update は次PRで調査・実装分離。

## 次PR候補

1. `docs/security/npm-audit-blocknote-major-update-plan.md`（方針固定）
2. `@blocknote core/mantine/react` の major アップデート影響調査 PR
3. `uuid` 経路の実装影響と段階的適用計画 PR
