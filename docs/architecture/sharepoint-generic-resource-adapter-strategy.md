# SharePoint Generic Resource Adapter Strategy

## 1. 目的

SharePoint 汎用 resource adapter を実装する前に、以下の 4 層の責務境界を固定する。

- Domain-specific layer
- Resource mapping layer
- Generic SharePoint adapter layer
- Transport layer

この文書は実装方針の境界定義であり、既存の SharePoint 実装、Graph 呼び出し、`spFetch`、ドリフト診断対象、SupportCase / RecordQuality の実装には変更を加えない。

## 2. 背景

SharePoint 連携は、業務ドメインごとに必要な値、SharePoint リストごとの物理構造、Graph API の通信都合が混ざりやすい。
この混在を放置すると、新しい resource を追加するたびに以下が起きる。

- ドメイン固有の解釈が SharePoint 汎用処理へ漏れる。
- SharePoint の列名・内部名・リスト名が UI や業務ロジックへ漏れる。
- Graph / `spFetch` の都合が repository や mapper の責務に入り込む。
- drift probe や resilience の運用契約が、resource ごとの ad hoc 実装に分散する。

汎用 adapter は「どの resource でも使える SharePoint CRUD 基盤」であり、業務意味論を持たないことを原則とする。

## 3. レイヤー責務

### 3.1 Domain-specific layer

Domain-specific layer は、業務ユースケースとドメインモデルの責務を持つ。

担当すること:

- SupportCase、RecordQuality などの業務モデルを定義する。
- 画面・use case・repository contract が必要とする読み書き操作を定義する。
- 必須項目、状態遷移、業務バリデーション、表示用の意味づけを扱う。
- SharePoint から返された resource を、業務として利用できるモデルへ変換する。

担当しないこと:

- SharePoint list title、list id、site id、drive id の解決。
- SharePoint internal name の候補探索。
- Graph URL、OData query、pagination、retry、認証の扱い。
- `spFetch` や Graph client の直接呼び出し。

依存してよいもの:

- Resource mapping layer の domain-specific mapper。
- Repository contract。
- Domain model と validation helper。

依存してはいけないもの:

- Transport layer。
- Graph response の生構造。
- SharePoint internal name の未解決値。

### 3.2 Resource mapping layer

Resource mapping layer は、業務モデルと SharePoint resource shape の対応を定義する。
ここが、domain-specific layer と generic adapter layer の唯一の翻訳境界になる。

担当すること:

- resource key と SharePoint list の対応を定義する。
- domain field と SharePoint field の対応を定義する。
- internal name drift を吸収するための候補、必須項目、読み書き可否を resource 単位で表現する。
- SharePoint item から domain object への decode を行う。
- domain input から SharePoint writable payload への encode を行う。
- 欠損、型不一致、drift 解決結果を domain-specific layer が扱える診断情報へ変換する。

担当しないこと:

- Graph API を呼ぶ。
- `spFetch` を呼ぶ。
- UI 表示文言を組み立てる。
- 業務状態遷移を判断する。
- resource をまたいだ集計や use case orchestration を行う。

Resource mapping は、以下の情報を持つことを想定する。

```ts
type ResourceMapping = {
  resourceKey: string;
  list: {
    title: string;
    siteKey?: string;
  };
  fields: Record<
    string,
    {
      displayName?: string;
      internalName?: string;
      candidates?: string[];
      required?: boolean;
      writable?: boolean;
    }
  >;
};
```

この型は概念例であり、この文書では実装ファイルや exported contract を追加しない。

### 3.3 Generic SharePoint adapter layer

Generic SharePoint adapter layer は、resource mapping を受け取り、SharePoint list item に対する汎用操作を提供する。
この層は業務ドメインを知らない。

担当すること:

- resource key から list metadata を解決する。
- mapping に基づいて SharePoint list item を読み書きする。
- internal name 解決済みの field map を使って select、filter、create、update payload を組み立てる。
- pagination、empty result、partial drift などを adapter contract として扱う。
- transport layer の response を adapter-level result へ変換する。
- drift 解決結果を mapping layer に返せる形で保持する。

担当しないこと:

- SupportCase、RecordQuality などの domain model を import する。
- domain field の業務意味を解釈する。
- Graph token、HTTP header、fetch 実装の詳細を持つ。
- drift probe target の登録内容を直接変更する。
- UI 向けのメッセージや toast を生成する。

Generic adapter の公開単位は、以下のような resource 操作に限定する。

- `list(resourceKey, query)`
- `get(resourceKey, id)`
- `create(resourceKey, input)`
- `update(resourceKey, id, patch)`
- `delete(resourceKey, id)`
- `probe(resourceKey)`

実際の命名は既存コードの規約に合わせるが、公開 contract は resource-oriented に保つ。

### 3.4 Transport layer

Transport layer は、SharePoint / Graph との通信だけを担当する。

担当すること:

- Graph endpoint への HTTP request を送る。
- 認証、header、HTTP method、retry、timeout、status code を扱う。
- `spFetch` など既存 transport helper の契約を維持する。
- response body、error body、request metadata を adapter が扱える raw result として返す。

担当しないこと:

- resource key の意味解釈。
- SharePoint list と domain の対応づけ。
- internal name drift の解決。
- domain object への変換。
- SupportCase / RecordQuality 固有の分岐。

Transport layer は最も下位の境界であり、domain-specific layer、resource mapping layer、generic adapter layer へ依存してはいけない。

## 4. 依存方向

許可される依存方向:

```text
Domain-specific layer
  -> Resource mapping layer
  -> Generic SharePoint adapter layer
  -> Transport layer
```

逆方向の import は禁止する。

特に禁止する依存:

- Generic SharePoint adapter layer から SupportCase / RecordQuality 実装を import する。
- Transport layer から resource mapping を import する。
- Domain-specific layer から `spFetch` を直接呼ぶ。
- Resource mapping layer から Graph URL を組み立てる。

## 5. Drift と probe の扱い

Drift は resource mapping layer の field 定義で表現し、generic adapter layer がそれを使って解決する。

原則:

- drift candidates は domain field ごとに定義する。
- 解決済み internal name は generic adapter layer の実行時文脈で扱う。
- drift probe target の登録は adapter 実装とは別の運用契約として扱う。
- adapter の導入だけを理由に `src/sharepoint/contracts/driftProbeTargets.ts` を変更しない。

Probe の責務分担:

- Resource mapping layer: 何を検査すべきかを表現する。
- Generic adapter layer: mapping に従って検査を実行する。
- Domain-specific layer: 検査結果を業務上の状態や運用アクションへ翻訳する。
- Transport layer: 検査に必要な HTTP request を送る。

## 6. Query と payload の境界

Domain-specific layer は、業務用の query input を定義してよい。
ただし SharePoint の OData 文字列を直接保持してはいけない。

Resource mapping layer は、domain query を adapter query へ変換する。
Generic adapter layer は、adapter query と field map から SharePoint query を組み立てる。
Transport layer は、完成済み request を送るだけにする。

Payload も同じ境界に従う。

- Domain-specific layer: domain input を受け取る。
- Resource mapping layer: writable field だけを SharePoint payload へ encode する。
- Generic SharePoint adapter layer: list item update/create として送れる shape に整える。
- Transport layer: request body を送る。

## 7. エラー境界

各層は、自分の責務に属するエラーだけを作る。

Domain-specific layer:

- 業務バリデーション失敗。
- 必須 domain state の不足。
- use case としての実行不可。

Resource mapping layer:

- domain field と SharePoint field の対応不足。
- encode / decode 不能。
- required field の欠損。

Generic SharePoint adapter layer:

- resource key 未登録。
- list metadata 解決失敗。
- internal name 解決失敗。
- adapter query の構築不能。

Transport layer:

- network error。
- HTTP error。
- auth error。
- Graph response parse error。

上位層へ返すときは、下位層の生エラーをそのまま UI へ露出させず、repository / domain contract で扱える result へ正規化する。

## 8. 実装時の受け入れ基準

将来、汎用 adapter を実装する PR は以下を満たすこと。

- adapter の core module が SupportCase / RecordQuality を import していない。
- transport helper の公開 contract を変更する場合は、adapter PR とは分けて扱う。
- domain repository は `spFetch` を直接呼ばない。
- mapping は resource 単位で追加でき、adapter core の分岐追加を必要としない。
- drift candidates は mapping / field definition 側で表現され、adapter core に domain-specific な候補を埋め込まない。
- docs、tests、implementation の責務が PR 単位で分離されている。

## 9. 今回の docs-only PR の範囲

この PR で行うこと:

- SharePoint generic resource adapter の責務境界を文書化する。
- 4 層の依存方向、禁止依存、drift / query / error の境界を定義する。

この PR で行わないこと:

- SharePoint 実装の変更。
- Graph / `spFetch` の変更。
- `src/sharepoint/contracts/driftProbeTargets.ts` の変更。
- SupportCase / RecordQuality 実装の変更。
- `.env` の変更。

---

最終更新日: 2026-06-11
