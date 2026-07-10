# ADR-024: モジュラーモノリスと業務モジュール境界

> **Status**: Accepted
> **Date**: 2026-07-10

## コンテキスト

本システムは、業務上の 7 層パイプライン、ISP L1/L2/L3、UI の 3 層分離、
Ports & Adapters をすでに採用している。一方、これらは異なる設計軸であり、
ディレクトリ階層へ一対一に写像すると、業務機能をまたぐ変更と共通層への責務集中を招く。

既存コードには feature 間の内部パス参照や domain から外部基盤への依存があるため、
全面再配置ではなく、新規違反を止めて業務モジュール単位で漸進移行する必要がある。

## 決定

### 全体構造

- 単一デプロイのモジュラーモノリスとする。
- DDD の考え方で `record-quality`、`monitoring`、`users`、`billing` などの
  業務機能をモジュール境界とする。
- 業務 7 層は処理モデル、ISP L1/L2/L3 は制度・業務境界として維持し、
  物理ディレクトリ階層へ一対一に対応させない。

### モジュール内部

各業務モジュールは次の責務に分割する。

```text
src/features/<module>/
├── index.ts       # 公開 API
├── ui/            # React UI、hooks、route
├── application/   # UseCase、ViewModel、ReadModel
├── domain/        # 純粋な業務型、状態遷移、ルール
├── ports/         # Repository 等の interface
└── adapters/      # SharePoint、Firestore、localStorage、InMemory
```

アプリケーション全体の DI と横断ユースケースの組み立ては `src/app` を
composition root として行う。

### 許可する依存方向

```text
ui          -> application
application -> domain
application -> ports
ports       -> domain
adapters    -> ports
adapters    -> domain
adapters    -> 外部基盤
app         -> 各モジュールの公開 index.ts
```

`ports -> domain` は Repository interface がドメイン型を引数・戻り値として扱うため許可する。

### 禁止する依存

- `domain -> ui / application / ports / adapters`
- `domain -> SharePoint / Firestore / localStorage` などの外部基盤
- module A から module B の `index.ts` 以外への参照
- module 外部から内部ディレクトリへの参照
- runtime の循環依存

### モジュール間連携

- 公開 `index.ts`
- 所有者が明確な共有契約
- `app` または application service によるオーケストレーション
- 即時結果を必要としない監査、テレメトリ、非同期集計に限ったイベント

### shared / common / lib の採用条件

共有層へ置けるのは、次のすべてを満たすものだけとする。

1. 2 つ以上のモジュールで実際に使用されている。
2. 業務上の所有モジュールを特定できない。
3. 外部基盤に依存しない。
4. 変更理由が一つである。
5. モジュール固有の型を参照しない。

業務概念を含む型は共有化せず、所有モジュールを決める。

### 移行方式

- 現在の違反をベースライン化し、新規違反だけを CI で失敗させる。
- 最初の実証対象は `record-quality` とし、`today` のような統合ハブは対象外とする。
- 既存コードは変更対象になったモジュールから漸進的に移行する。
- ADR、依存ガード、公開 API、内部再配置を別の変更単位として扱う。

## 理由

- 単一デプロイと既存運用を維持したまま、変更影響を業務モジュール内へ閉じられる。
- 既存の Repository、Adapter、ドメイン型 SSOT を再利用できる。
- 大規模な一括移行を避け、依存ルールを実装と CI で検証できる。

## 利点

- 業務機能の所有者と公開契約が明確になる。
- domain を外部基盤から分離し、単体テストを安定させられる。
- 既存違反を残したままでも、アーキテクチャ劣化の増加を止められる。

## トレードオフ

- 移行期間中は旧配置と新配置が併存する。
- 公開 API と依存ベースラインのレビュー運用が必要になる。
- モジュール間オーケストレーションを composition root へ移す追加作業が生じる。

## 非採用

- 全面再配置、一括 Clean Architecture 化
- CRUD 全体のイベント駆動化
- 独立スケーリングや別チーム運用の根拠がない段階でのマイクロサービス化

## 維持する既存判断

- ADR-005 の ISP L1/L2/L3
- ADR-009 の Support Operations OS 設計原則
- ADR-014 の SharePoint SSOT Drift Contract
- ドメイン型 SSOT と ADR 優先順位
