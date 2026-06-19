# PR CI Triage Rules

Updated: 2026-06-16

## Ready化してよい候補

- `changedFiles` が少ない
- `mergeable` が true / MERGEABLE
- `failure` がない
- `pending` がない
- known flaky 以外の失敗がない
- 別端末作業中ではない
- 差分が docs-only / test-only / fixture-only など、影響範囲が限定されている

## 保留するPR

- `mergeStateStatus` が `BEHIND`
- `quality_extended` が `failure`
- 別端末作業中
- `pending` が残っている
- Draft で CI 未確定
- E2E 以外の失敗原因が未確認
- 差分由来か既知 flaky か切り分けできていない

## 触らない操作

以下は、明示判断があるまで実施しない。

- main追従
- rerun
- merge
- Ready化
- 追加修正

## 既知 flaky の扱い

`E2E Smoke (Chromium)` の flaky 系失敗は、単独では差分由来と断定しない。

ただし、以下が同時にある場合は保留する。

- `quality_extended` failure
- `Deep Tests (Chromium)` failure
- Unit / TypeCheck / Lint failure
- 差分対象に近いテスト失敗

## 現在の適用例

- `#2294`
  - Draft
  - 1ファイル test-only
  - `quality_extended` 完了待ち
  - Ready化しない

- `#2290` / `#2291` / `#2292`
  - 別端末作業中
  - 触らない

- `#2285` / `#2286` / `#2280`
  - `BEHIND`
  - `quality_extended` failure
  - 保留

## PR監視補助メモ（VS Code運用）

VS Code の Agents window は、複数の PR 監視・別端末作業・docs-only 整理を分離する用途に使う。

### セッション分離の例

- `#2294` 監視セッション
- Planning Sheet 作業セッション
- docs-only / runbook 整理セッション
- CI failure 調査セッション

### Session sync / Chronicle の扱い

個人開発・公開リポジトリ中心の作業では、PR番号・ブランチ・触ったファイルを後から追えるため有効化候補とする。

一方で、以下を含む作業では無効のままにする。

- 利用者名
- 職員名
- 支援記録
- 相談メモ
- 医療・福祉・家庭内の個人情報
- 事業所内部の未公開情報

### Research agent / 1M context の扱い

Research agent と 1M context は常用しない。

使う場面を以下に限定する。

- 大きな設計調査
- 複数PRの横断整理
- architecture / system-map / runbook の棚卸し
- unfamiliar code の読み取り専用調査

### Integrated browser screenshot の扱い

UI確認では、Integrated browser の screenshot 機能を活用する。

主な対象:

- kiosk UI
- planning sheet
- ActivityDiary
- ひなたアプリ
- layout / routing / reduced motion の確認

ただし、個人情報や支援記録が画面に出ている場合は、スクリーンショットを chat に添付しない。

## 確認の基本コマンド

- `gh pr view <PR番号> --json state,isDraft,mergeable,mergeStateStatus,changedFiles,headRefName,headRefOid`
- `gh pr checks <PR番号>`

## 判断の原則

CI状態は `gh pr checks` を優先して確認する。
GitHub API の combined status だけでは Actions の詳細が取れない場合がある。

## 作業ブランチの扱い

既存PRのブランチでは、明示判断なしに以下をしない。

- `git pull`
- `git merge main`
- `git rebase main`
- `追加コミット`
