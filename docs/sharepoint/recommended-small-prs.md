# Recommended next small PRs (docs/test scope first)

## 方針
- まずは docs-only / test-only を優先し、実装変更は最小限の監査合意後に段階実施
- drift リスクの見える化を先行し、環境再現性を上げる

## 候補1: docs-only（最優先）
- docs: normalize drift intent and glossary
- 対象ファイル:
  - `docs/sharepoint/drift-inventory.md`
  - `docs/sharepoint/field-mapping-notes.md`
  - `docs/sharepoint/drift-risk-report.md`
  - `docs/sharepoint/recommended-small-prs.md`
- 目的:
  - list/field 一覧、例外、根拠ファイル、環境依存、運用手順を1か所に集約
  - `High risk` を人間レビューに先回し

## 候補2: test-only（docs実装に対する補助）
- docs: clarify existing behavior contracts with tests
- 対象ファイル候補:
  - `src/sharepoint/__tests__/driftProbeRegistry.spec.ts`
  - `tests/unit/spListHealthCheck.spec.ts`
- 目的:
  - 既存仕様（`lifecycle`、`billing_orders` の除外条件、`buildListCheckPath`）の固定を維持
  - 新規仕様は入れず、監査要件との不一致箇所を明確化するテストケースを追加
- 注意:
  - 本タスクではテスト変更は行わない（次回イテレーション）

## 候補3: docs-only（運用手順）
- `docs/sharepoint/drift-inventory.md` に環境別確認手順を追加
  - local/prod の `VITE_*` 差分確認
  - supportCase 診断 flag のオン/オフ影響確認
  - drift 対象リストの snapshot 差分取り方

## 候補4: docs-only（監査レポート雛形）
- `docs/sharepoint/daily-drift-review-checklist.md` の新規追加（任意）
- 計測項目:
  - 対象 List/Field 増減有無
  - 誤検知/未検知の再現手順
  - 監査者承認ポイント
- ※命名・テンプレートは既存 docs 規約に合わせる

## 切り出し条件（小PRとしての安全基準）
- 差分は docs のみ
- `.env` を一切触らない
- 既存未コミット差分に干渉しない
- 1 PR あたり 1 ドメイン（例: risk, mapping, operations）

## Human review required
- drift 対象外リスト（`support cases` と関連）の運用方針
- queryGuard の fail-open 継続判断
- `billing_orders` のsite分岐除外を監査要件で許容するか
- ListSpec 生成 (`buildListSpecs`) の必要最小ルールの固定
