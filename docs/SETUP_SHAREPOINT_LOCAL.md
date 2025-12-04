# ローカルで SharePoint 連携を有効にするための一括ガイド

このドキュメントは、ローカル（Vite 開発サーバ）で SharePoint に接続し、Schedules の Create を実行・検証するための手順をまとめたものです。

0. 前提
- 本リポジトリは Vite + React + MSAL + SharePoint REST で動作します。
- Org_Master の取得、Schedules の GET は成功している前提です。

1. `.env.local` の準備
- プロジェクトルートに `.env.local` を作成し、以下の最小項目を入れてください（`<...>` は置き換え）：

```text
VITE_SKIP_SHAREPOINT=0
VITE_SP_RESOURCE=https://isogokatudouhome.sharepoint.com
VITE_SP_SITE_PATH=/sites/welfare
VITE_MSAL_CLIENT_ID=<Azure App の Client ID>
VITE_MSAL_TENANT_ID=650ea331-3451-4bd8-8b5d-b88cc49e6144
VITE_FEATURE_SCHEDULES=1
VITE_FEATURE_SCHEDULES_WEEK_V2=1
VITE_FEATURE_SCHEDULES_CREATE=1
---
# ローカル環境構築 & SharePoint(Schedules) POST 検証ガイド（完全版）

このガイドはリポジトリ内の以下ファイルを使い倒して、ローカルから SharePoint へ `POST` が通るところまでを一本道でまとめます。

対象ファイル
- `.env.local.example`
- `docs/SETUP_SHAREPOINT_LOCAL.md` (このファイル)
- `scripts/curl_schedule_post.sh`
- `scripts/add_org_fields.ps1`

---

0) 前提
- Node / npm / Git がインストール済み
- ローカル URL: `http://localhost:5173`
- SharePoint site: `https://isogokatudouhome.sharepoint.com/sites/welfare`
- リスト名: `Org_Master`, `Schedules`

1) env を有効化（最重要: `schedulesCreate` を true にする）

1. `.env.local.example` をコピーして `.env.local` を作成します:

```bash
cp .env.local.example .env.local
```

2. `.env.local` を開き、最低以下が truthy であることを確認してください:

```text
VITE_FEATURE_SCHEDULES=1
VITE_FEATURE_SCHEDULES_CREATE=1    # ← ないと POST が走らない
VITE_SKIP_SHAREPOINT=0
VITE_DEMO=0
VITE_E2E=0
```

2) アプリ起動

```bash
npm install
npm run dev
```

起動後、ブラウザ DevTools Console に次のようなログが出ていることを確認します:

```
[flags] { schedules: true, schedulesCreate: true, ... }
```

もし `schedulesCreate` が false のままなら、開発用の裏技で一時的に ON にできます（再起動不要）:

```js
localStorage.setItem("feature:schedulesCreate", "1");
location.reload();
```

3) SharePoint 接続の生存確認（GET）

ログイン時に MSAL の成功ログや SP の GET が通っていることを確認します。Console に次が出ればトークン周りは OK:

```
[msal] acquireTokenSuccess
[SPFetch] URL: .../_api/web/currentuser?$select=Id
```

4) ターミナルで “POST 再現” をする（`curl_schedule_post.sh`）

目的: UI を介さず、ターミナルから直接 `POST` が通るか確認します。

4-1) Bearer トークンを用意する

Chrome の DevTools → Network で SharePoint へ飛んでいる任意リクエストを選び、`Request Headers` の `Authorization: Bearer ...` を丸ごとコピーします。

4-2) スクリプトにトークンをセットする

```bash
export TOKEN="Bearer ey..."
chmod +x scripts/curl_schedule_post.sh
./scripts/curl_schedule_post.sh
```

成功すれば `201 Created` と作成されたアイテムの `Id` が返ります。

注意: トークンは短時間だけ使ってください。長期保存は避けてください。

5) UI から保存 → Network で payload を見る

手順:

1. DevTools → Network → `Fetch/XHR` を ON
2. `Preserve log` を ON
3. 保存ボタンを押す
4. `.../Schedules/items` の行をクリック
5. 右ペインで `Headers` / `Payload` / `Response` を確認

ポイント: 右ペインが表示されていない場合は DevTools の Dock を変えて表示させてください。SharePoint REST は `Request Payload` 表示になることが多いので、POST 行をしっかり選択してください。

6) Schedules に Org 情報を残す設計（推奨）

運用・監査面で安全なのは「Lookup と複製列を持つ」パターンです。

推奨フィールド（Schedules 側）:

- `OrgLookup` (Lookup → `Org_Master` の `Title`) — 参照
- `OrgCode` (Text) — Org のコードを複製
- `OrgType` (Choice) — Org のタイプを複製
- `Audience` (Choice) — 複製
- `LocationName` (Text) — 表示用コピー
- `IsActiveAtEntry` (Yes/No) — 保存時点の活動フラグ
- `OrgNotesSnapshot` (MultilineText) — Org 側の重要メモを保存

軽量な代替案としては `OrgCode` のみ保存する方法がありますが、Org を後で編集すると過去データに影響するため監査用途には向きません。

7) Schedules 側の列を PowerShell で一括追加（`add_org_fields.ps1`）

Mac/Windows どちらでも PowerShell を使えます。手順例:

```bash
# macOS の例
brew install powershell    # まだなら
pwsh
# PowerShell の中で
Install-Module PnP.PowerShell -Scope CurrentUser
Connect-PnPOnline -Url "https://isogokatudouhome.sharepoint.com/sites/welfare" -Interactive
pwsh ./scripts/add_org_fields.ps1
```

スクリプトは `OrgLookup` と複製列を追加します。実行後、SharePoint の Schedules リスト設定画面で列が増えていることを確認してください。

8) 成功判定チェックリスト

- Console: `[flags] { schedulesCreate: true }`
- Network (UI): `POST .../Schedules/items` が出る（Payload が見える）
- Terminal (curl): `201 Created` が返る
- SharePoint: Schedules に新レコードが増えている

9) 次の実装ステップ（UI 側）

短くまとめると:

1. Org_Master を選ぶ Autocomplete を UI に実装
2. 選択された Org を snapshot 化して `payload` に注入
3. 現行の保存ハンドラで `POST` を行い `201` を受け取ったら画面更新

必要なら `SupportRecordPage` 系の TSX を貼ってください。具体的なパッチ（payload の組み立て・送信）を書きます。

---

追記パッチ案（Markdown lint の指摘を直す場合）

もし `docs/SETUP_SHAREPOINT_LOCAL.md` の lint 指摘を直す場合、次の点を自動修正案として当てられます:

- 見出しの順序と空行の調整
- すべての fenced code block に言語指定を追加
- 箇条書きと番号付きリストの整形

パッチを当ててよければ私が続けます。

---

実行してほしい最初のアクション

1) `chmod +x scripts/curl_schedule_post.sh` を実行済みか教えてください（してなければ私が実行します）
2) ステップ4の手順で `curl` を実行して結果（`201 Created` が返ったか）を教えてください
3) 同様に UI 側で保存を試して、Network に `POST` 行が出るか、Payload が確認できたか教えてください

これらの結果を受けて、保存ハンドラのパッチや UI 実装を続けます。

---
