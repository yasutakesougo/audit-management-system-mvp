# npm audit（omit=dev）棚卸しメモ

更新日: 2026-07-07  
補足: 2026-07-14 時点の最新 `main` では、`xlsx` direct dependency は存在しない。月次サマリ出力は CSV 契約であり、公式帳票 Excel は `exceljs` 系の別機能として扱う。
実行条件:
- `npm audit --omit=dev --json`  
- `npm audit --omit=dev`
- 対象ブランチ: `codex/npm-audit-triage`（本PRは依存更新を行わない棚卸しのみ）

## 取得コマンド

- JSON保存先: `%TEMP%/npm-audit-omit-dev.json`
- 対象依存は production 依存のみ

## 監査結果サマリ

| パッケージ | installed | severity | advisory | fix availability | major update required | app runtime impact |
|---|---:|---|---|---|---|---|
| xlsx | 0.18.5 | high | GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 | none | no | 履歴上の検出。2026-07-14 時点の最新 `main` では direct dependency なし |
| @blocknote/core | 0.47.3 | moderate | UUID経由（GHSA-w5hq-g745-h8pq） | 0.51.4 | yes | yes（エディタ機能として直接利用） |
| @blocknote/mantine | 0.47.3 | moderate | UUID経由（GHSA-w5hq-g745-h8pq） | 0.51.4 | yes | yes（エディタ機能として間接〜直接利用） |
| @blocknote/react | 0.47.3 | moderate | UUID経由（GHSA-w5hq-g745-h8pq） | 0.51.4 | yes | yes（エディタ機能として間接〜直接利用） |
| firebase | 10.14.1 | moderate | undici関連（GHSA-c76h-2ccp-4975 他） | 12.15.0 | yes | yes（認証/データ系を直接利用） |
| exceljs | 4.4.0 | moderate | GHSA-w5hq-g745-h8pq | 3.4.0 (force) | yes | yes（帳票処理経由で利用） |
| undici | 6.19.7 | high | GHSA-c76h-2ccp-4975, GHSA-g9mf-h72j-4rw9, GHSA-cxrh-j4jr-qwg3, GHSA-f269-vfmq-vjvj, GHSA-2mjp-6q6p-2qxm, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8, GHSA-4992-7rv2-5pvq, GHSA-p88m-4jfj-68fv, GHSA-vxpw-j846-p89q, GHSA-35p6-xmwp-9g52, GHSA-g8m3-5g58-fq7m | firebase (force) | yes | yes（firebase 依存鎖） |
| uuid | 8.3.2 | moderate | GHSA-w5hq-g745-h8pq | exceljs@3.4.0 (force) | yes | yes（@blocknote と exceljs の依存鎖） |

## 分類

- `fixAvailable = false`: xlsx（履歴上の検出。現行 `main` では direct dependency なし）
- `major update required`: firebase、@blocknote、exceljs 経由の uuid、undici（firebase経由）
- `app runtime impact`: 上記 8件すべて

## 本PRで実施しない方針

- Firebase の major 更新
- `@blocknote` 系 major 更新
- `xlsx` の置換・機能削減を伴う対応（現行 `main` では月次サマリが CSV 契約）
- アプリ実装（runtime code）変更
- lockfile 更新

## 次レーン候補（分離PR）

1. `xlsx` No-fix（fixAvailable=false）対応方針の確認（2026-07-14 時点では direct dependency なしとして再分類）
2. firebase major update（互換性影響が大きいため別PR）
3. `@blocknote` major update（UI/編集機能影響を見極める別PR）
4. `xlsx` 代替 / 機能維持を含む更新候補（別PR）
