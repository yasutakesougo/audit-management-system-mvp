# Labels Reference

このリポジトリでは、CI負荷とレビュー効率を両立するために **ラベル駆動**で運用します。

## Workflow Labels（必須）

| Label | Purpose | When to use | Who uses |
|---|---|---|---|
| `run-ci` | 重いCI（fast-lane / storybook-a11y / e2e-smoke 等）を起動する | レビュー準備が完了したタイミングで付与 | PR作成者 |
| `ready-for-review` | レビュー開始の合図 | PRの説明/DoD/テスト状況が揃ったら付与 | PR作成者 |

## Type Labels（推奨）

| Label | Purpose | Who uses |
|---|---|---|
| `ci/infra` | CI/インフラ改善 | Maintainers / PR作成者 |
| `docs` | ドキュメント更新 | 全員 |
| `refactor` | リファクタリング | 全員 |
| `bug` | バグ修正 | 全員 |
| `feature` | 新機能 | 全員 |

## Priority Labels（任意）

※ Projects の Priority フィールドで管理している場合は省略可。

| Label | Meaning |
|---|---|
| `priority:P0` | クリティカル（開発停止・本番影響・セキュリティ） |
| `priority:P1` | 高（早期解決で効率が上がる） |
| `priority:P2` | 中（通常対応） |
| `priority:P3` | 低（時間ができたら） |

## よくある運用フロー

1. **WIP / Draft**：ラベル無し（重いCIは走らない）
2. **レビュー準備完了**：`ready-for-review` を付与
3. **CIを回す**：`run-ci` を付与（CI/Verify列へ）
4. **マージ**：Done へ

## 運用のコツ

- **Draft PR で早期フィードバック**: `ready-for-review` や `run-ci` を付けずにレビュー要求
- **スモークテスト優先**: `run-ci` を付ける前に、軽いCI（typecheck, lint）は必ず通す
- **重いCIは必要なときだけ**: e2e-smoke や storybook-a11y は `run-ci` があるときのみ起動

詳細は [PROJECT_BOARD.md](PROJECT_BOARD.md) を参照してください。
