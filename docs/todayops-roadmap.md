# TodayOps ロードマップ

> **設計哲学**: 時間最適化 ❌ → 安心最適化 ⭕
>
> 現場を急がせるためではなく、
> 現場が安心して仕事を終えられるように設計する。

---

## Phase 0.5 — Shift Awareness（現場担当状態）🆕

> **最後のピース**: TodayOps を「タスクボード」から「現場状況盤」に変える

**目標**: いま誰が現場を見ているか / 次に誰が見るかを明示する

**なぜ重要か**:
- 福祉現場で最も多い事故は「Aさんが見てると思ってた / Bさんがやったと思ってた」
- これはタスク管理の問題ではなく **責任状態の問題**
- この1行があるだけで TodayOps = 現場の責任状態になる

**UI イメージ**:
```
-----------------------------------
現場担当  佐藤（14:00〜）
次の担当  山田（16:30〜）
-----------------------------------
未処理 3件
```

**実装**:
| 項目 | 内容 |
|------|------|
| 新規 Hook | `useCurrentShift()` → `{ currentStaff, nextStaff }` |
| 新規 Widget | `<ShiftStatusBar />` — Hero の上に配置 |
| データソース | `Staff.baseShiftStartTime` / `baseShiftEndTime` （**すでに存在**） |
| 推定行数 | 約 80〜120 行 |

**副次効果**: Handoff（申し送り）が「今の担当 → 次の担当」という文脈を持ち、意味が明確になる。

---

## Phase 1 — TodayOps Redirect ✅ DONE

**目標**: ユーザーが `/today` に自然に到達する

| 項目 | 状態 |
|------|------|
| `DashboardRedirect` でロール・フラグに基づくルーティング | ✅ |
| Feature Flag (`VITE_FEATURE_TODAY_OPS`) による制御 | ✅ |
| 本番 1 週間トライアル観察 | ⏳ 実施中 |

**次のステップ**: 本番で `VITE_FEATURE_TODAY_OPS=1` を有効化し、1 週間観察後に Phase 2 へ。

---

## Phase 2 — TimeSlot Ordering

**目標**: 朝・昼・夕の時間帯に合わせてタスクを並べる

- 予定ベースの時間帯分類（morning / afternoon / evening）
- 時間帯ごとの視覚的グループ化
- 既存の `useNextAction` urgency 判定を時間帯と連携

---

## Phase 3 — TodayEngine（統合エンジン）

**目標**: 未記録 / 申し送り / スケジュールを統合して「今日やるべきこと」を一つのリストにする

- Pure function: `buildTodayTasks(sources) → Task[]`
- デデュプリケーション（重複タスクの統合）
- 安全上限（最大 30 件）
- データソース: Schedule + Attendance + Handoff

---

## Phase 4 — Zero Remaining Tasks + Closing Acknowledgement

**目標**: 終業時に「今日の確認は完了です」を保証し、**人間が「確認した」と宣言できる**

### 4a. Zero Remaining（システム側の状態）
- 全タスク完了時の「お疲れさま」表示
- 未完了タスクの明示的な繰越 or 完了確認
- 日次クローズの audit trail

### 4b. Closing Acknowledgement（人間側の意思表示）🆕

> Zero Remaining だけではシステムが「残数ゼロ」と言っているだけ。
> **「確認しました」は人間の意思表示** — この違いが決定的。

**UI イメージ**:
```
☐ 未記録ゼロ
☐ 未対応申し送りゼロ
☐ 今日の確認事項ゼロ

[ 今日の確認を完了 ]

↓ 押すと

✓ 本日の確認を完了しました
  担当: 佐藤  17:32
```

**状態遷移**:
```
未処理 → ゼロ残 → 確認済
```

**実装（MVP）**: 約 30 行
```tsx
// state
const [closingAcknowledged, setClosingAcknowledged] = useState(false);

// button
<Button onClick={() => setClosingAcknowledged(true)}>
  今日の確認を完了
</Button>

// display
{closingAcknowledged && (
  <Alert severity="success">
    本日の確認を完了しました
  </Alert>
)}
```

**将来拡張**（MVP では不要）:
- SharePoint `DailyClosingLog` リストに保存（date / staff / time）
- Shift Awareness と連携し「現場担当: 佐藤 — 確認済 17:32」を表示

**なぜ効くか**: 仕事の終わりが可視化される → **心理的な区切り** → 安心して帰れる

---

## Phase 5 — Learning Workplace OS

> 現場を急がせるためではなく、
> 現場が安心して仕事を終えられるように学習する。

**やらないこと（意図的に除外）**:
- ❌ 残り時間の表示（対人対応ではプレッシャーになる）
- ❌ 効率スコア・パフォーマンス指標
- ❌ 時間最適化の提案

**やること**:
- ⭕ 見落とし防止（チェック漏れの検知と通知）
- ⭕ 自然なタスク順序の学習（曜日・時間帯パターン）
- ⭕ 繰越パターン学習（よく繰り越されるタスクの事前提示）

### MVP 定義

| 機能 | 説明 |
|------|------|
| 繰越パターン検知 | 「この曜日はいつも繰り越されるタスク」をスマート表示 |
| 順序サジェスト | 過去パターンに基づく並び順（強制ではなく提案） |
| 見落とし通知 | 「昨日の未完了が引き継がれていません」「○○さんの記録がまだです」 |

---

## TodayOps 完成構造

```
Shift Awareness     → 誰が見ているか
     ↓
TodayEngine         → 何をやるか
     ↓
Zero Remaining      → 全部終わったか
     ↓
Closing Ack         → 確認したか
```

**つまり**: 状況 → 行動 → 完了 → 確認

この4段階が揃うと TodayOps は **「業務の1日の流れ」** そのもの。

---

## 設計原則

```
効率を上げるシステム → 現場のストレスが増える → 使われなくなる ❌

安心して終われる → 現場が使い続ける → 結果として効率が上がる ⭕
```

福祉現場向けシステムは **安心の順序** が正しい。

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-10 | 初版作成。Phase 5 を「時間最適化」から「安心最適化」に設計変更 |
| 2026-03-10 | Phase 0.5「Shift Awareness」を追加。Staff型のbaseShiftStartTime/EndTimeを活用 |
| 2026-03-10 | Phase 4 に「Closing Acknowledgement」を追加。完成構造図を追記 |
| 2026-03-10 | レイアウト指示書 (`todayops-layout-spec.md`) を作成 |
| 2026-03-10 | **判断**: サイドメニューは試運用完了まで変更しない（変数切り分けのため） |

---

*関連: [TodayOps 技術仕様](./todayops.md) / [Today ガードレール](./today-guardrails.md) / [Rollout Runbook](./runbook/today-ops-rollout.md) / [レイアウト指示書](./todayops-layout-spec.md) / [試運用レビュー会](./runbook/today-ops-trial-review.md)*
