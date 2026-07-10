# Module Starter Checklist

新規モジュール、および業務変更に伴って境界を整える既存モジュール向けのチェックリストです。
[ADR-024](../adr/ADR-024-modular-monolith-module-boundaries.md) と
[移行プレイブック](../architecture/modular-monolith-migration-playbook.md) を正とします。

## 1. Module Boundary

- [ ] 業務上の所有者と責務を一つのfeature moduleとして説明できる
- [ ] 外部公開する型・UseCase・UIを `src/features/<module>/index.ts` に限定した
- [ ] 他featureの内部パスを直接importしていない
- [ ] 業務7層やISP L1/L2/L3をディレクトリへ一対一に写像していない

## 2. Internal Layers

- [ ] 純粋な業務型・状態遷移・ルールを `domain` に置いた
- [ ] Repository interfaceを `ports` に置いた
- [ ] UseCase・ViewModel・ReadModelを `application` に置いた
- [ ] React UI・hooksを `ui` に置いた
- [ ] SharePoint、Firestore、localStorage、InMemory実装を `adapters` に置いた
- [ ] domainがUI、adapter、外部基盤へ依存していない

## 3. Composition

- [ ] UI内でRepositoryを生成していない
- [ ] 環境選択と依存注入をadapterまたは `src/app` のcomposition rootに置いた
- [ ] モジュール横断処理を公開APIまたはapplication service経由で組み立てた
- [ ] 即時結果が不要な監査・テレメトリ以外を安易にイベント化していない

## 4. Shared Decision

- [ ] shared/commonへ移動する場合、ADR-024の5条件をすべて満たした
- [ ] 業務概念を共有化せず、所有モジュールを決めた
- [ ] ドメイン型SSOTを複製していない

## 5. Verification

- [ ] 対象モジュールのテストが通る
- [ ] `npm run arch:check` が新規違反0、baseline 921以下で通る
- [ ] `npm run typecheck:full -- --pretty false`、`npm run lint`、`npm run build` が通る
- [ ] 既存挙動、業務7層、ISP境界、ADR優先順位を変更していない
- [ ] 必要なVerification Checklistと本番Runbookを更新した
