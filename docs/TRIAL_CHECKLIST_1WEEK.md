# TodayOps 試運用チェックリスト（1週間）

> 期間: 2026-03-10 〜 2026-03-17
> 判定: **Go**（Firestore telemetry 権限は #834 で解決済み）
> デプロイ: Cloudflare Worker `346cedd7` / Feature Flag `VITE_FEATURE_TODAY_OPS=true`

---

## 観測項目

| # | 観測ポイント | 確認方法 | 結果 |
|---|------------|---------|------|
| 1 | `/today` が自然に使われているか | 画面キャプチャ or ヒアリング | |
| 2 | dashboard に戻る動きがあるか | ヒアリング | |
| 3 | 初回タップ先はどこか | 観察 | |
| 4 | 困った場面はあったか | ヒアリング | |
| 5 | 「無くなったら困るか」 | 1週間後に質問 | |

---

## オープン Issue

| Issue | 内容 | 優先度 | 対応タイミング |
|-------|------|--------|--------------|
| #833 | schedule-day.aria.smoke 調査 | Low | 試運用後 |
| #834 | Firestore telemetry 権限 | ~~Medium~~ Done | rules 修正済み |

---

## 試運用中の変更ログ

> **原則：観測期間中は変数を増やさない。**
> ただし、業務導線の致命的不整合は「軽微改善」として即時対応し、記録する。

### 2026-03-10（Day1）: ブリーフィング導線接続

**変更内容:**
- 📞 連絡確認 → 欠席情報登録導線（`/daily/attendance?absence=USER_CODE`）に変更
- 📝 申し送り作成 → 既存の申し送りダイアログに接続

**理由:**
元のボタンは両方とも `setState(key, 'done')` のみで、機能として成立していなかった。
スタッフに「触って体感してもらう」ためには、ボタンが実際の業務画面に繋がる必要がある。

**分類:** 機能追加ではなく、既存業務導線の接続改善

**影響範囲:**
- `BriefingActionList.tsx` — contact-confirm をナビゲーションに変更
- `AttendancePanel.tsx` — `?absence=` URLパラメータで欠席ダイアログ自動起動
- `BriefingActionList.spec.tsx` — テスト更新

**テスト:** 全14テスト通過（BriefingActionList） / 全126テスト通過（Attendance）

### 2026-03-11（Day2）: Firestore telemetry 権限修正 (#834)

**変更内容:**
- `firestore.rules` に `telemetry` コレクションの `create` ルールを追加
- payload 検証（`type` 必須 / キー数上限20）で最低限の悪用防止

**理由:**
`telemetry` コレクションに対応する rules が存在せず、全書き込みが Firestore のデフォルト deny で棄却されていた。
本アプリは MSAL (Azure AD) 認証であり Firebase Auth を使用しないため、`request.auth` は常に null。
よって認証なしで `create` のみ許可し、payload shape で制約をかける方式とした。

**分類:** 設定修正（Firestore Security Rules）

**影響範囲:**
- `firestore.rules` — telemetry コレクション create ルール追加
- コード変更なし（既存 telemetry 実装はそのまま動作する）

**テスト:** typecheck 通過 / telemetry 関連テスト 11件 全通過

---

## 3/17 レビュー会ゴール

決めるのは3つだけ：

1. **TodayOps 継続可か**
2. **Phase 0.5（Shift Awareness）を入れるか**
3. **Phase 3（TodayEngine）に進むか**
