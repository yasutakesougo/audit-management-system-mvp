# 30分 実査ログ（viewer → reception → admin）

目的: 「やった気になる検証」ではなく、マージ可否を判断できる実査ログを残す。

---

## 0. セッション情報

- 実施日:
- 実施者:
- 対象PR/ブランチ:
- 環境（local/stg/prod相当）:
- 対象機能:

---

## 1. 実行順と時間（固定）

1. `viewer`（10〜15分）
2. `reception`（5分）
3. `admin`（5分）

合計: 30分を1セットとして実施。

---

## 2. 判定ルール（固定）

- `A/B/C` に Fail: 即修正対象（このPRで閉じる）
- `D/E` に Fail: 軽微なら次PRで可（起票必須）

---

## 3. 本質ポイント（必ず記録）

### viewer
- 観点: 「迷う瞬間があったか？」
- 結果: Pass / Fail
- メモ:

### admin
- 観点: 「今まで出来ていたことが出来なくなっていないか？」
- 結果: Pass / Fail
- メモ:

---

## 4. ログ（ロール別）

| ロール | 実施時間 | A | B | C | D | E | 主な事象/気づき |
|---|---:|---|---|---|---|---|---|
| viewer | 10-15分 | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |
| reception | 5分 | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |
| admin | 5分 | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail |  |

---

## 5. Failチケット

| 区分 | ロール | 事象 | 重要度 | 対応方針 | Issue/PR |
|---|---|---|---|---|---|
| A/B/C or D/E | viewer/reception/admin |  | High/Medium/Low | 即修正 / 次PR |  |

---

## 6. 最終Gate（Go/No-Go）

- [ ] viewerが迷わない
- [ ] adminが困らない
- [ ] 機能が壊れていない（回帰なし）

判定: `GO` / `NO-GO`  
理由:

