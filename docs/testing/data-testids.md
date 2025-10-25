# data-testid Reference (E2E)

> 本ファイルは E2E テストの安定化を目的に、**命名規約**・**辞書**・**型安全セレクタ**の入口を一箇所に集約します。

## 命名規約
- `kebab-case`。画面単位は `page-*`、要素は `*-btn`, `*-input`, `*-table` など。
- E2E が触る **主要操作** には必ず testid を付与（クリック、入力、保存、タブ切替）。
- i18n 非依存：可視ラベルや文言はアサートに使わず、**必ず testid** で取得。

## 代表例（ソースファイル出典）
| Category            | Example                                       | Source File                |
|---------------------|-----------------------------------------------|----------------------------|
| App Root            | `app-root`, `app-router-outlet`               | `App.tsx`                  |
| Toast               | `toast-announcer`, `toast-message`            | `useToast.ts`              |
| Record List         | `record-form`, `record-table`, `record-row`   | `RecordList.tsx`           |
| Support Procedures  | `support-procedures/form`, `support-procedures/table`, `support-procedures/toast` | `testids.ts`, 各画面 |

> 追加時は `tests/e2e/utils/selectors.ts` の型に **必ず**反映してください。
