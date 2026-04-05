# PR2-PR4 Operational Validation Checklist

## Purpose
PR2-PR4 で実施した「露出制御」「Today導線固定」「admin surface分離」が、実運用で意図どおり機能するかを確認する。

## Scope
- Included:
  - PR2: ナビ露出制御
  - PR3: `/today` 起点コア導線固定
  - PR4: admin surface route guard
- Excluded:
  - 機能追加/削除の是非評価
  - データ品質（入力内容そのもの）の監査

## Test Setup
- Environment: `main` latest
- Browser: Chrome (latest)
- Roles:
  - `viewer`
  - `reception`
  - `admin`

---

## A. Viewer Core Flow (最重要)
期待: viewer が 3クリック以内で日次業務を開始できる。

| ID | Check | Expected | Result |
|---|---|---|---|
| A-0 | ログイン直後 | viewer が `/today` を起点に開始できる | ☐ Pass / ☐ Fail |
| A-1 | `/today` 初期表示 | 今日やること（attendance / table / handoff）が主表示 | ☐ Pass / ☐ Fail |
| A-2 | `/today` → `/daily/attendance` | 迷わず遷移できる | ☐ Pass / ☐ Fail |
| A-3 | `/daily/attendance` → `/daily/table` | 遷移導線が分かる | ☐ Pass / ☐ Fail |
| A-4 | `/daily/table` → `/handoff-timeline` | 申し送り導線へ到達できる | ☐ Pass / ☐ Fail |
| A-5 | 操作迷い | 不要な管理/分析選択肢が前面にない | ☐ Pass / ☐ Fail |

---

## B. Viewer Admin Surface Guard
期待: viewer は運用面ルートに入らず `/today` へ戻る。

| ID | Direct URL | Expected | Result |
|---|---|---|---|
| B-1 | `/analysis/dashboard` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-2 | `/analysis/intervention` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-3 | `/ops` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-4 | `/handoff-analysis` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-5 | `/exceptions` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-6 | `/exceptions/audit` | `/today` へリダイレクト | ☐ Pass / ☐ Fail |
| B-7 | ブラウザ戻る | guard 後に戻る操作で不正ループしない | ☐ Pass / ☐ Fail |

---

## C. Reception/Admin Reachability
期待: reception/admin は必要導線を失っていない。

| ID | Role | Route | Expected | Result |
|---|---|---|---|---|
| C-1 | reception | `/analysis/dashboard` | 表示できる | ☐ Pass / ☐ Fail |
| C-2 | reception | `/ops` | 表示できる | ☐ Pass / ☐ Fail |
| C-3 | reception | `/exceptions` | 表示できる | ☐ Pass / ☐ Fail |
| C-4 | admin | `/analysis/dashboard` | 表示できる | ☐ Pass / ☐ Fail |
| C-5 | admin | `/admin/exception-center` | 表示できる | ☐ Pass / ☐ Fail |
| C-6 | admin | `/admin/status` | 表示できる | ☐ Pass / ☐ Fail |

---

## D. Navigation Exposure Check
期待: viewer には core が前面、運用面は後段/非表示。

| ID | Check | Expected | Result |
|---|---|---|---|
| D-1 | viewer サイドナビ | `analysis/ops/exceptions/handoff-analysis` が前面表示されない | ☐ Pass / ☐ Fail |
| D-2 | viewer More展開 | 補助導線のみ表示（管理面露出なし） | ☐ Pass / ☐ Fail |
| D-3 | admin サイドナビ | 管理導線が到達可能 | ☐ Pass / ☐ Fail |
| D-4 | mobile nav | モバイルでも core / More の露出が意図どおり | ☐ Pass / ☐ Fail |

---

## E. Regression Guard
期待: URL/route 構造と既存機能は壊れていない。

| ID | Check | Expected | Result |
|---|---|---|---|
| E-1 | `/today` | 正常表示・主要CTAが表示される | ☐ Pass / ☐ Fail |
| E-2 | `/daily/attendance` | 正常表示 | ☐ Pass / ☐ Fail |
| E-3 | `/daily/table` | 正常表示 | ☐ Pass / ☐ Fail |
| E-4 | `/handoff-timeline` | 正常表示 | ☐ Pass / ☐ Fail |
| E-5 | JS errors | コンソール重大エラーなし | ☐ Pass / ☐ Fail |

---

## Acceptance Criteria
- 必須条件:
  - A セクション: 全 Pass
  - B セクション: 全 Pass
  - C セクション: 全 Pass
- 許容:
  - D/E は軽微な文言差分のみ要調整で可（導線破壊は不可）

判定:
- ✅ Ready to Rollout: 必須条件すべて Pass
- ⚠️ Needs Fix: 必須条件に Fail が1つでもある

---

## Notes Template
```
Date:
Tester:
Role:
Browser:

Observed:
- 

Fail Cases:
- [ID] 

Suggested Follow-up:
- 
```
