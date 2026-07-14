# Cloudflare Production 人間作業 Runbook

対象: `yasutakesougo/audit-management-system-mvp`
Environment: `cloudflare-production`

SharePoint integration用Repository Secretを更新し、同一`main` SHAで3レーンを確認した後、Cloudflare本番Environmentを準備する手順です。完了範囲は**環境準備まで**であり、`deploy-cloudflare-worker`は起動しません。

## 0. 作業前確認

役割を分離します。

- 作業者: SecretとEnvironmentを登録できる管理者
- 承認者: 作業者とは別の、リポジトリにread権限以上を持つ人またはチーム
- 認証端末: SharePointログインとMFAが正常に行える信頼済み端末1台

画面・ターミナル録画、PowerShell Transcript、`set -x`、クリップボード履歴を停止します。

次の場合は作業を止めます。

- Secret値、`storageState.json`、Base64文字列が表示された
- 作業途中で`main` SHAが変わった
- 3 runの`headSha`が一致しない
- 別担当のrequired reviewerまたは`main`限定ルールを設定できない
- 登録値の出所、対象Cloudflareアカウントを確認できない

Secret値を表示した場合は、その値を失効・再発行してからやり直します。

## 1. `PW_STORAGE_STATE_B64`を更新する

これはEnvironment Secretではなく**Repository Secret**です。3 workflowが必要とする既存`SHAREPOINT_SITE`も、名前だけ確認します。

```bash
gh secret list \
  --repo yasutakesougo/audit-management-system-mvp \
  --json name,updatedAt \
  --jq '.[] | select(.name == "SHAREPOINT_SITE" or .name == "PW_STORAGE_STATE_B64")'
```

`SHAREPOINT_SITE`がなければ停止します。値は表示・更新しません。

### macOS（zsh / bash）

```bash
cd <audit-management-system-mvpのパス>
npm ci
printf 'SharePoint site URL: '
IFS= read -r SHAREPOINT_SITE
export SHAREPOINT_SITE

trap 'rm -f tests/.auth/storageState.json; unset SHAREPOINT_SITE' EXIT

npm run auth:setup
test -s tests/.auth/storageState.json \
  || { echo 'storageState.json was not generated or is empty'; exit 1; }

base64 < tests/.auth/storageState.json \
  | tr -d '\n' \
  | gh secret set PW_STORAGE_STATE_B64 \
      --repo yasutakesougo/audit-management-system-mvp

rm -f tests/.auth/storageState.json
unset SHAREPOINT_SITE
trap - EXIT
```

### Windows PowerShell

```powershell
Set-Location "<audit-management-system-mvpのパス>"
npm ci
$env:SHAREPOINT_SITE = Read-Host "SharePoint site URL"

try {
    npm run auth:setup
    if ($LASTEXITCODE -ne 0) { throw "auth:setup failed" }

    $state = Get-Item "tests/.auth/storageState.json" -ErrorAction Stop
    if ($state.Length -eq 0) {
        throw "storageState.json was not generated or is empty"
    }

    [Convert]::ToBase64String(
        [IO.File]::ReadAllBytes($state.FullName)
    ) | gh secret set PW_STORAGE_STATE_B64 `
        --repo yasutakesougo/audit-management-system-mvp

    if ($LASTEXITCODE -ne 0) {
        throw "PW_STORAGE_STATE_B64 update failed"
    }
}
finally {
    Remove-Item "tests/.auth/storageState.json" -Force -ErrorAction SilentlyContinue
    Remove-Item Env:SHAREPOINT_SITE -ErrorAction SilentlyContinue
}
```

`npm run auth:setup`は`/_api/web/currentuser`の成功後だけ`tests/.auth/storageState.json`を保存します。登録後は必ず削除します。

```bash
gh secret list \
  --repo yasutakesougo/audit-management-system-mvp \
  --json name,updatedAt \
  --jq '.[] | select(.name == "PW_STORAGE_STATE_B64")'
test ! -e tests/.auth/storageState.json
git status --short
```

完了条件:

- `updatedAt`が今回の作業時刻
- `storageState.json`が残っていない
- `git status --short`に今回の作業による追加ファイルがない

## 2. 同一`main` SHAで3レーンを実行する

古いrunの再実行は使いません。以下はmacOS、Linux、Git BashまたはWSLで実行します。

### 2.1 一時タグを作成する

```bash
REPO='yasutakesougo/audit-management-system-mvp'
TARGET_SHA="$(gh api "repos/${REPO}/git/ref/heads/main" --jq .object.sha)"
TAG_NAME="integration-auth-${TARGET_SHA:0:12}"
printf 'TARGET_SHA=%s\nTAG_NAME=%s\n' "$TARGET_SHA" "$TAG_NAME"

if gh api "repos/${REPO}/git/ref/tags/${TAG_NAME}" --silent 2>/dev/null; then
  echo "Tag already exists: ${TAG_NAME}"
  exit 1
fi

gh api --method POST "repos/${REPO}/git/refs" \
  -f ref="refs/tags/${TAG_NAME}" \
  -f sha="${TARGET_SHA}"
```

SHAとタグ名を作業記録へ残します。同名タグを確認せず上書きしてはいけません。

### 2.2 dispatchする

```bash
gh workflow run integration-users.yml --repo "$REPO" --ref "$TAG_NAME"
gh workflow run integration-staff.yml --repo "$REPO" --ref "$TAG_NAME"
gh workflow run integration-dailyops.yml --repo "$REPO" --ref "$TAG_NAME"
```

### 2.3 今回のrun IDを特定する

```bash
for workflow in integration-users.yml integration-staff.yml integration-dailyops.yml; do
  gh run list \
    --repo "$REPO" \
    --workflow "$workflow" \
    --commit "$TARGET_SHA" \
    --event workflow_dispatch \
    --limit 10 \
    --json databaseId,createdAt,headSha,status,conclusion,url
done
```

runが現れるまで再実行します。`--limit 1`だけで古いrunを採用せず、今回のdispatch時刻と`createdAt`を照合します。複数候補ならURLを開いて今回のrunを確定します。

```bash
USERS_RUN_ID='<users run ID>'
STAFF_RUN_ID='<staff run ID>'
DAILYOPS_RUN_ID='<dailyops run ID>'
```

### 2.4 完了と最終結果を確認する

```bash
gh run watch "$USERS_RUN_ID" --repo "$REPO" --exit-status
gh run watch "$STAFF_RUN_ID" --repo "$REPO" --exit-status
gh run watch "$DAILYOPS_RUN_ID" --repo "$REPO" --exit-status

for run_id in "$USERS_RUN_ID" "$STAFF_RUN_ID" "$DAILYOPS_RUN_ID"; do
  gh run view "$run_id" --repo "$REPO" \
    --json databaseId,headSha,status,conclusion,url
done
```

失敗があっても残りのrunを確認します。別SHAのrunで補完してはいけません。3 runすべてが次を満たす場合だけ合格です。

- `headSha == TARGET_SHA`
- `status == completed`
- `conclusion == success`

run ID、URL、結果を記録後、成功・失敗にかかわらずタグを削除します。

```bash
gh api --method DELETE \
  "repos/${REPO}/git/refs/tags/${TAG_NAME}"
```

再確認時もタグを作り直し、新しい3 runを起動します。

## 3. `cloudflare-production`を作成する

GitHubでRepository → Settings → Environments → New environmentと進みます。

1. 名前を`cloudflare-production`にする
2. Deployment branches and tagsでSelected branches and tagsを選ぶ
3. Branch ruleに`main`だけを追加する
4. `main`以外のbranch/tag ruleがないことを確認する

この時点ではEnvironment Secretが空でも構いません。

## 4. required reviewerを設定する

`cloudflare-production`のDeployment protection rulesで設定します。

1. Required reviewersにデプロイ開始者とは別の人またはチームを追加
2. Prevent self-reviewを有効化
3. Allow administrators to bypass configured protection rulesを無効化
4. Save protection rules

reviewerにはread権限以上が必要です。最大6ユーザーまたは6チームを登録でき、1人の承認でjobが進みます。

リポジトリは現在publicです。将来private/internalへ変更して項目が表示されない場合は、[GitHubの利用条件](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments)を確認します。別担当による承認を実現できない場合は未完了です。

## 5. Environment Secretを登録する

Cloudflare DashboardのAccount API Tokens → Create Token → Edit Cloudflare WorkersからTokenを作成し、デプロイ先アカウントだけに限定します。TokenはGitHub CLIへ直接入力し、`.env`、Markdown、チャット等へ保存しません。

正規名7件を1件ずつ登録します。

```bash
REPO='yasutakesougo/audit-management-system-mvp'
ENVIRONMENT='cloudflare-production'

for secret_name in \
  CLOUDFLARE_API_TOKEN \
  CLOUDFLARE_ACCOUNT_ID \
  VITE_SP_RESOURCE \
  VITE_SP_SITE_RELATIVE \
  VITE_MSAL_CLIENT_ID \
  VITE_MSAL_TENANT_ID \
  VITE_MSAL_REDIRECT_URI
do
  gh secret set "$secret_name" --env "$ENVIRONMENT" --repo "$REPO"
done
```

| Secret名 | 登録する情報 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Workersデプロイ用に限定したAPI Token |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイ先Cloudflare Account ID |
| `VITE_SP_RESOURCE` | SharePointのオリジンURL |
| `VITE_SP_SITE_RELATIVE` | SharePointサイトの相対パス |
| `VITE_MSAL_CLIENT_ID` | 本番用Entra IDアプリのClient ID |
| `VITE_MSAL_TENANT_ID` | Entra ID Tenant ID |
| `VITE_MSAL_REDIRECT_URI` | 本番アプリの完全なRedirect URI |

旧AAD名へのfallbackはありますが、新規登録では正規名だけを使います。

`VITE_*`はクライアントJavaScriptへ埋め込まれます。Client Secret、パスワード、API Token、storageState等を入れてはいけません。

名前と更新時刻だけを確認します。

```bash
gh secret list \
  --env cloudflare-production \
  --repo yasutakesougo/audit-management-system-mvp \
  --json name,updatedAt \
  --jq 'sort_by(.name)'
```

任意Variable `VITE_SP_LIST_BILLING_ORDERS`と`VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE`は、workflowの既定値と異なる場合だけEnvironment Variableとして登録します。

## 6. 表示・保存・artifact化の禁止

次の操作は禁止です。

```text
echo "$CLOUDFLARE_API_TOKEN"
cat tests/.auth/storageState.json
base64 tests/.auth/storageState.json
Write-Output $Token
Get-Content tests/.auth/storageState.json
Set-Clipboard $Token
```

Secret値をチャット、Issue、PR、Markdown、README、`.env`、テキスト、スクリーンショット、CIログ、artifactへ貼り付けてはいけません。

integration workflowのartifact対象は`test-results`と`playwright-report`です。`tests/.auth`や`storageState.json`を追加してはいけません。

作業後はstorageState削除、クリップボード消去、Token画面終了、Secret名と`updatedAt`の確認、`git status --short`確認を行います。

## 7. Secret値を含まない作業記録

```text
実施日時（JST）:
作業者:
承認者:
TARGET_SHA:

users run ID / URL / headSha / status / conclusion:
staff run ID / URL / headSha / status / conclusion:
dailyops run ID / URL / headSha / status / conclusion:

cloudflare-production作成: yes / no
Deployment branch main限定: yes / no
required reviewer設定: yes / no
Prevent self-review: yes / no
管理者バイパス禁止: yes / no

PW_STORAGE_STATE_B64 updatedAt:
Environment Secret 7件の名前とupdatedAtを確認: yes / no
storageState.json削除: yes / no
git status --short clean: yes / no
```

## 8. 最終チェック

- [ ] `PW_STORAGE_STATE_B64`の更新時刻を確認
- [ ] `storageState.json`を削除
- [ ] users、staff、dailyopsが対象SHAでsuccess
- [ ] 3 runの`headSha`が完全一致
- [ ] 一時タグを削除
- [ ] `cloudflare-production`が存在
- [ ] Deployment branchが`main`だけ
- [ ] required reviewerを登録し、開始者と承認者を分離
- [ ] Prevent self-reviewが有効
- [ ] 管理者バイパスが無効
- [ ] Cloudflare Secret 2件と`VITE_*` Secret 5件を登録
- [ ] 名前と`updatedAt`だけを確認
- [ ] `git status --short`がclean
- [ ] `deploy-cloudflare-worker`を起動していない

## 参考資料

- [GitHub: Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub: Reviewing deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments)
- [GitHub CLI: `gh workflow run`](https://cli.github.com/manual/gh_workflow_run)
- [GitHub CLI: `gh run list`](https://cli.github.com/manual/gh_run_list)
- [GitHub CLI: `gh secret set`](https://cli.github.com/manual/gh_secret_set)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Vite: Env Variables and Modes](https://vite.dev/guide/env-and-mode.html)
