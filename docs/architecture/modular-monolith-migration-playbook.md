# Modular Monolith Migration Playbook

ADR-024 を、既存機能を止めずに業務モジュールへ適用するための運用手順です。
`record-quality` を最初の実証例とし、未変更モジュールの再配置は行いません。

## 固定する設計契約

- 全体は単一デプロイのモジュラーモノリスとする。
- DDD の業務機能をモジュール境界とする。
- 業務 7 層、ISP L1/L2/L3、ドメイン型 SSOT、ADR 優先順位は維持する。
- モジュール外からの参照は公開 `index.ts` に限定する。
- Repository interface は `ports`、基盤実装は `adapters`、全体の組み立ては
  `src/app` の composition root に置く。
- CRUD 全体のイベント化、全面再配置、根拠のないマイクロサービス化は行わない。

```text
src/features/<module>/
├── index.ts
├── ui/
├── application/
├── domain/
├── ports/
└── adapters/
```

許可する依存方向と共有層の採用条件は
[ADR-024](../adr/ADR-024-modular-monolith-module-boundaries.md) を正とします。

## 着手条件と優先順位

移行は、そのモジュールに機能変更または不具合修正が発生した場合だけ着手します。
移行だけを目的に、未変更モジュールを再配置してはいけません。

同時に複数候補へ変更が入る場合の優先順位は次のとおりです。

1. `billing`
2. `monitoring`
3. `users`

`today` は統合ハブであるため、複数の低リスクモジュールで運用が定着するまで
移行対象外とします。

## 変更前の境界調査

対象モジュールを `<module>` として、少なくとも次を確認します。

```bash
# 外部から内部パスを直接参照している箇所
rg "@/features/<module>/|features/<module>/" src \
  --glob '!src/features/<module>/**'

# domain から UI、adapter、外部基盤への依存
rg "@/features|@/lib|sharepoint|firebase|localStorage" \
  src/features/<module>/domain

# 現在の依存ガード
npm run arch:check
```

調査結果はPR本文に、公開する契約、残す既存違反、今回削減する違反として記録します。

## PRの分割

原則として、次の順序を別PRに分けます。各PRは既存挙動を変えず、単独でCIを通します。

1. **公開API**: `index.ts` を定義し、外部利用を公開APIへ寄せる。
2. **内部境界**: 純粋な業務ルールを `domain`、Repository契約を `ports` へ置く。
3. **基盤分離**: SharePoint、Firestore、localStorage等の実装を `adapters` へ置く。
4. **composition**: UI内のRepository生成や横断オーケストレーションを `src/app` へ移す。

小規模モジュールで複数段階をまとめる場合も、公開API、内部境界、compositionの差分が
レビュー上識別できる状態にします。別モジュールの移行は同じPRへ混在させません。

## 完了条件

```bash
npm run arch:check
npm run typecheck:full -- --pretty false
npm run lint
npm run build
```

- 新規依存違反が0件である。
- known violations baselineが921件以下で、変更前から増えていない。
- 対象モジュールのテストが通る。
- 外部からの内部パス参照、domainから外部基盤への参照、runtime循環依存が増えていない。
- 業務7層、ISP境界、ドメイン型SSOT、既存の利用者向け挙動を変更していない。

違反を削減した場合だけ `npm run arch:baseline` でbaselineを更新します。手編集や、
無関係な違反を含む全面再生成は行いません。

## shared / common への移動

次のすべてを満たす場合だけ共有層へ置けます。

1. 2つ以上のモジュールで実際に使われている。
2. 業務上の所有モジュールを特定できない。
3. 外部基盤に依存しない。
4. 変更理由が一つである。
5. モジュール固有の型を参照しない。

条件を満たさない業務概念は、所有モジュールを決めて公開APIから提供します。

## 実証例

`src/features/record-quality` を標準例とします。新しいモジュール境界を設計するときは、
公開 `index.ts`、`domain / application / ports / adapters / ui`、および
`src/app/routes/RecordQualityHumanReviewRoute.tsx` のcompositionを参照してください。
