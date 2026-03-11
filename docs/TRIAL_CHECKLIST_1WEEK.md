# TodayOps 試運用チェックリスト（1週間）

> 期間: 2026-03-10 〜 2026-03-17
> 判定: **Conditional Go**（Firestore telemetry 権限のみ未解決）
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
| #834 | Firestore telemetry 権限 | Medium | 試運用中でも可 |

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

---

## 3/17 レビュー会ゴール

決めるのは3つだけ：

1. **TodayOps 継続可か**
2. **Phase 0.5（Shift Awareness）を入れるか**
3. **Phase 3（TodayEngine）に進むか**
