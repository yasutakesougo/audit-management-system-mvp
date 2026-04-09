# ナビゲーション構造図

> 設計原則: ADR-005 の三層モデル・画面責務表・IBD Mode に基づく。
> この図がナビゲーション設計の地図であり、画面ワイヤー・メニュー文言統一の前提となる。
>
> **更新ルール**: 新規画面追加時は必ずこの図を更新してから `navigationConfig.ts` を変更すること。
>
> **更新チェックリスト**（PRレビュー時に確認）
> - [ ] この図（`navigation-structure.md`）を更新したか
> - [ ] ADR-005 の Anti-Patterns・画面責務表と矛盾していないか
> - [ ] UIラベル統一規則に従っているか
> - [ ] IBD対象/非対象で導線差分を確認したか
> - [ ] ロール表示原則と整合しているか

---

## 全体構造（三系統）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  系統A: 全利用者共通                                                       │
│  系統B: IBD対象者専用（強度行動障害支援）                                    │
│  循環導線: 第1層 ⇄ 第2層 ⇄ 第3層                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 系統A: 全利用者共通

```
利用者マスタ (/users)
 └── 利用者詳細 (/users/:id)
      ├── ISP サマリー
      └── [IBD対象の場合] → SPS詳細へ（系統Bへ接続）

個別支援計画 [第1層]
 ├── ISP作成         /support-plan-guide       主目的: 制度計画の作成
 └── ISP更新（比較） /isp-editor               主目的: 前回版との比較・更新
                                               ※ admin のみ表示

日々の記録 [第1層系日次記録]
 └── ケース記録      /daily/table              主目的: 一覧型ケース記録（Type A/B）
                                               対象: 全利用者
                                               ※ IBD対象者の実施記録はここではない
```

---

## 系統B: IBD対象者専用

```
支援計画シート一覧 /planning-sheet-list       [第2層]
 └── SPS詳細 /support-planning-sheet/:id      [第2層]
      主目的: 行動特性分析・氷山分析・支援設計・手順スケジュール定義
      ├── 氷山モデル（observableBehaviors / underlyingFactors）
      ├── 良い状態の条件（positiveConditions）
      ├── 手順スケジュール定義
      ├── 3か月見直し期限（MonitoringCountdown）
      ├── [planningSheetId 付き遷移] ──────────────────────────────────┐
      └── [PDCA 導線]──────────────────────────────────────────────────┤
                                                                         │
支援手順の実施・記録 /daily/support?wizard=user  [第2層→第3層 ブリッジUI] ←┘
 主目的: SPSに紐づく手順を現場で実行しながら記録する
 Input  : planningSheetId・schedule（手順定義）  ← 第2層（read-only）
 State  : filledStepIds・step logs・notes
 Output : 実施ログ・モニタリングシグナル          → 第3層
 ├── Step1: 利用者選択（wizard=user）
 ├── Step2: 支援計画選択
 ├── Step3: 手順実施・ステップチェック・記録入力
 └── [完了後] → PDCA / 見直し へ

分析ワークスペース /analysis/dashboard          [第2層（PDCA補助）]
 主目的: 観察エビデンス・分析支援・見直し判断の補助
 ※ 日次実施ログの入力画面ではない。入力責務は /daily/support に属する。

PDCA / 見直し /ibd/pdca/:id 等                 [第2層 ⇄ 第3層]
 主目的: 実施ログを第2層へフィードバック・再アセスメント・計画改訂
 └── [改訂確定] → SPS更新 → 必要に応じ ISP見直し
```

---

## 循環導線（層をまたぐ遷移）

```
ISP（第1層）
 │  ISPReference（スナップショット参照）
 ▼
SPS 支援計画シート（第2層）
 │  planningSheetId
 ▼
/daily/support  ブリッジUI（第2→3層）
 │  実施ログ・モニタリングシグナル
 ▼
PDCA / 見直し（第2⇄3層）
 │  再アセスメント結果
 ▼
SPS 改訂（第2層更新）
 │  必要時
 ▼
ISP 見直し（第1層更新）
 ↑_________________________________
        循環（継続的改善サイクル）
```

---

## ロール表示原則

| ロール | 表示できる導線 |
|---|---|
| `admin` | 全導線（ISP更新比較・PDCA・SPS・支援手順の実施・分析ワークスペース含む） |
| `staff` | 日々の記録・支援計画シート・支援手順の実施・PDCA |
| `reception` | 日々の記録・サービス提供実績記録・個人月次業務日誌 |
| `all`（viewer含む） | 日々の記録（閲覧のみ） |

実装上の判定: `src/app/config/navigationConfig.ts` の `NAV_AUDIENCE` に従う。
IBD専用導線（SPS・`/daily/support`・PDCA）はロール制御に加え、`isSevereDisabilityAddonEligible` を必ず確認すること。

---

## ナビゲーショングループと三層の対応

| navグループ | 主な画面 | 三層での位置 | 対象 |
|---|---|---|---|
| `today` | 日々の記録 `/daily/table` | 第1層 | 全利用者 |
| `today` | 支援手順の実施 `/daily/support` | 第2→3層ブリッジ | IBD対象者のみ |
| `planning` | ISP作成/更新 `/support-plan-guide` `/isp-editor` | 第1層 | 全利用者 |
| `planning` | 支援計画シート `/planning-sheet-list` | 第2層 | IBD対象者のみ |
| `planning` | 分析ワークスペース `/analysis/dashboard` | 第2層（PDCA） | IBD対象者のみ |
| `master` | 利用者マスタ `/users` | 横断 | 全ロール |

---

## IBD対象者かどうかの分岐点

```
利用者詳細 (/users/:id)
 │
 ├── isSevereDisabilityAddonEligible = false
 │    └── 表示: ISP情報・ケース記録導線のみ
 │
 └── isSevereDisabilityAddonEligible = true
      └── 追加表示:
           ├── SPS タブ / 支援計画シート導線
           ├── /daily/support への導線
           ├── MonitoringCountdown
           └── PDCA / IcebergPdca リンク
```

判定ロジック: `src/domain/regulatory/severeDisabilityAddon.ts` の `checkUserEligibility()`

---

## UIラベル統一規則（メニュー・ページタイトル）

| 場面 | 使うラベル | 使わないラベル |
|---|---|---|
| 全利用者の日次記録 | **日々の記録** | ケース記録、日報、日次記録入力 |
| IBD専用計画文書 | **支援計画シート** | SPS、第2層、IBD計画書 |
| IBD専用実施画面 | **支援手順の実施** | 記録入力、日次支援記録 |
| IBD専用振り返り | **見直し・PDCA** | 再アセスメント画面 |
| 設計層の呼称 | *(UI上に出さない)* | 第1層・第2層・第3層 |

---

## 関連ドキュメント

- [ADR-005: ISP三層モデル](./adr/ADR-005-isp-three-layer-separation.md) — 設計の根拠と禁止事項
- [navigation.md](./navigation.md) — ナビゲーションOSの実装ルール
- `src/app/config/navigationConfig.ts` — 実装
- `src/domain/regulatory/severeDisabilityAddon.ts` — IBD判定ロジック

---

## Changelog

- 2026-04-09: 初版作成。三系統・循環導線・IBD分岐・UIラベル規則を定義
- 2026-04-09: ロール表示原則・分析ワークスペース責務定義・更新チェックリストを追記
