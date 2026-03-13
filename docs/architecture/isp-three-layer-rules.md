# ISP 三層モデル — 実装ルール（圧縮版）

> AI エージェント・開発者が ISP 関連の実装判断をする際に **最初に読む 1 ページ**。
> 詳細は [ADR-005](../adr/ADR-005-isp-three-layer-separation.md) / [ADR-006](../adr/ADR-006-screen-responsibility-boundaries.md) / [実装構造マップ](./isp-three-layer-code-structure.md) を参照。

---

## 絶対ルール（15 条）

### 概念分離

1. **ISP と支援計画シートは別文書・別画面・別 Repository・別ライフサイクル** で管理する
2. **ISP は上位計画**（意向・方針・目標・同意・交付・モニタリング）のみを扱う
3. **支援計画シートは専門支援設計**（行動分析・仮説・支援課題・支援手順）を扱う
4. **Daily は実行と記録のみ** を扱う。設計の変更は行わない

### Iceberg

5. **Iceberg は PlanningSheet に紐づく**（`IcebergPdcaItem.planningSheetId`）
6. **Iceberg を ISP に直接紐付けてはならない**（`ispId` フィールドを追加禁止）
7. **Iceberg の件数・日付は `useIcebergEvidence` hook のみから取得** する

### 参照方向

8. **Daily → PlanningSheet / ISP の編集は禁止**（読取・導線のみ）
9. **ISP 画面での行動分析・仮説・支援課題の直接編集は禁止**
10. **RegulatoryDashboard は読取専用**（全層を横断チェックするが書き込まない）

### Evidence

11. **evidence source を画面ごとに分岐させてはならない**（`useIcebergEvidence` に統一）
12. **evidence の集計は `aggregateIcebergEvidence()` 純粋関数を通す**

### データ品質

13. **全文書に版管理・作成者・更新者・作成日・更新日を持たせる**
14. **ISP の同意・交付・モニタリング・見直しの証跡を省略しない**
15. **監査時に説明不能な設計を行わない**

---

## 許可される参照方向

```
✅ ISP → PlanningSheet     参照表示（シート一覧）
✅ PlanningSheet → Iceberg  分析接続（件数・日付）
✅ PlanningSheet → Daily    導線（実行画面へ遷移）
✅ Daily → ProcedureRecord  記録（実行結果を書き込み）
✅ RegulatoryDashboard → 全層  読取専用チェック
```

## 禁止される参照方向

```
❌ Daily → PlanningSheet    編集
❌ Daily → ISP              編集
❌ ISP → Iceberg            直接紐付け
❌ 画面固有の evidence 集計  新設
❌ ISP 画面での行動分析編集
```

---

## 主キー / 参照キー

```
ISP.id ←─────── PlanningSheet.ispId
  │                    │
  │                    ├── ProcedureRecord.planningSheetId
  │                    │
  │                    └── IcebergPdcaItem.planningSheetId
  │
  └── userId ========= 全エンティティ共通
```

---

## 画面責務マトリクス

| 画面 | ルート | 読む | 書く | 絶対に書かない |
|------|--------|------|------|-------------|
| ISP | `/support-plan-guide` | ISP, PS一覧, Evidence | ISP | PS本体, 行動分析, 手順 |
| 支援計画シート | `/support-planning-sheet/:id` | PS, Iceberg | PS | ISP本文 |
| Daily | `/daily/support` | ProcedureStep (Bridge経由) | ProcedureRecord | ISP, PS |
| Dashboard | `/admin/regulatory-dashboard` | ISP, PS, Iceberg, PR | なし | 全て |

---

## Hook 使用ルール

| データが必要なとき | 使う Hook | 絶対に使わないもの |
|------------------|----------|----------------|
| Iceberg 件数・日付 | `useIcebergEvidence(userId)` | 画面ローカルの手動集計 |
| ISP + シート + 記録 の束 | `useSupportPlanBundle(userId, repos)` | 個別 fetch の組み合わせ |
| 制度サマリー | `useRegulatorySummary(draft, bundle)` | 直接 auditChecks 呼び出し |

---

## Bridge 使用ルール

| 変換 | 関数 | 呼ぶ場所 |
|------|------|---------|
| PlanningSheet → Daily 時間割 | `toDailyProcedureSteps()` | Daily 画面 |
| 手順の優先解決 | `resolveProcedureSteps()` | Daily 画面 |
| Daily 行動記録 → 制度記録 | `toProcedureRecord()` | Daily 画面 |

Bridge は `src/domain/isp/bridge/` にのみ配置する。
画面側に変換ロジックを書いてはならない。

---

## 新規画面追加チェックリスト

新しい画面を追加する前に、以下を確認する。

- [ ] **責務の明確化**: この画面は ISP / PlanningSheet / Daily / Dashboard のどれに該当するか？
- [ ] **読み書きの分離**: 読むものと書くものを明示できるか？書かないものも明示したか？
- [ ] **Iceberg の紐付け先**: Iceberg データを使う場合、`useIcebergEvidence` 経由か？
- [ ] **evidence source**: 画面固有の集計を新設していないか？
- [ ] **参照方向**: 禁止される方向の参照（Daily→PSの編集 等）をしていないか？
- [ ] **Bridge の位置**: 層間の変換ロジックを `domain/isp/bridge/` に置いたか？画面に書いていないか？
- [ ] **キーの一貫性**: `planningSheetId` で紐づけているか？`ispId` で Iceberg を引いていないか？
- [ ] **監査証跡**: 版管理・作成者・更新日を持つ設計になっているか？
- [ ] **ADR-006 照合**: 画面責務境界の定義と矛盾していないか？

---

## よくある誤りパターン

| パターン | なぜ誤りか | 正しい実装 |
|---------|----------|-----------|
| ISP フォームに PlanningSheet の編集 UI を埋め込む | 責務混在。ライフサイクルが違う | 別画面（`/support-planning-sheet/:id`）に分離 |
| Daily 画面で支援課題を変更する | Daily は実行と記録のみ | PlanningSheet 画面で変更 |
| `IcebergPdcaItem` に `ispId` を追加する | Iceberg は PS に紐づく | `planningSheetId` を使う |
| Dashboard で findings を直接編集する | Dashboard は読取専用 | 対象画面への navigate で修正 |
| 画面内で `IcebergPdcaItem[]` を手動集計する | evidence source の分岐 | `useIcebergEvidence` を使う |
| Bridge 関数を `features/daily/` に配置する | Bridge は domain 層 | `domain/isp/bridge/` に配置 |

---

> **迷ったらこの 1 ページに戻る。それでも判断できなければ [実装構造マップ](./isp-three-layer-code-structure.md) を確認する。**
