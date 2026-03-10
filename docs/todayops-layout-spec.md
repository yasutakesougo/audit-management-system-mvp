# TodayOps レイアウト指示書

> **原則**: 「情報の見やすさ」ではなく「現場の1日の思考順」に並べる
>
> 画面の配置 = 現場スタッフの頭の中の順序

---

## 配置の原則

```
① いまの責任状態     → 誰が見ているか
② いま最初に見るべき → まずこれ
③ いま動くための入口 → 記録する・対応する
④ 周辺状況          → 必要なら確認
⑤ 終わりの確認      → 全部終わったか
```

**現場の思考フロー**:
```
画面を開く → 誰が見ているか
次に見る   → まず何をするか
そして動く → じゃあ記録する
広く確認   → 出席や申し送りも見よう
最後に閉じ → 今日はもう大丈夫か
```

---

## 重み付け（3レベル）

| レベル | 意味 | ウィジェット | 位置 |
|--------|------|-------------|------|
| **A: 必ず見る** | 最初の1秒 | ShiftStatusBar, Hero, focusTask | 最上段 |
| **B: すぐ使う** | 行動の入口 | TodayTasksCard, QuickRecord, NextAction, UserCompactList | 中段 |
| **C: 必要時に見る** | 補助情報 | Attendance, Briefing, ServiceStructure, Transport, Schedule | 下段 |

> [!IMPORTANT]
> A → B → C の重みの差を崩さないこと。全カードを同格に並べると「結局どれを見るの？」になる。

---

## 推奨レイアウト構造

### Desktop / Tablet (md: 4-column)

```
┌──────────────────────────────────────┐
│  🔵 ShiftStatusBar (full-width)      │  ← Level A: 責任状態
│  現場担当: 佐藤 (14:00〜)            │
│  次の担当: 山田 (16:30〜)            │
├──────────────────────────────────────┤
│  🟠 Hero (full-width, sticky)        │  ← Level A: 最優先の認知
│  未記録 3件 / 承認待ち 1件           │
├──────────────────────────────────────┤
│  ⬛ Focus Alert (full-width)         │  ← Level A: まずこれ
│  「まず○○さんの記録をお願いします」  │  （未実装 → Phase 3）
├──────────┬───────────────────────────┤
│ NextAction│    UserCompactList        │  ← Level B: 行動の入口
│  (1col)   │    + QuickRecord (3col)   │
│  ▶️次に   │    👥 記録する            │
│  やること │                           │
├──────────┴───────────────────────────┤
│  📊 Attendance(1) + 📋 Briefing(3)  │  ← Level C: 周辺状況
├──────────────────────────────────────┤
│  🏢 ServiceStructure (full 4col)     │  ← Level C
├──────────────────────────────────────┤
│  🚌 Transport (full 4col)            │  ← Level C
├──────────────────────────────────────┤
│  ✅ EndOfDayChecklist (full 4col)    │  ← Level C: 終業確認
│  [ 今日の確認を完了 ]                │  （未実装 → Phase 4）
└──────────────────────────────────────┘
```

### Mobile (1-column) — 縦並び

```
🔵 ShiftStatusBar
🟠 Hero
⬛ Focus Alert
▶️ NextAction
👥 UserCompactList / QuickRecord
📊 Attendance
📋 Briefing
🏢 ServiceStructure
🚌 Transport
✅ EndOfDayChecklist / Closing Ack
```

---

## 現在のレイアウトとの差分

### 現在 (`TodayBentoLayout.tsx`)

```
Hero                              ← OK（Level A）
Attendance(1) + Briefing(3)       ← ⚠️ Level C が上にある
ServiceStructure(4)               ← ⚠️ Level C が上にある
Users(3) + NextAction(1)          ← ⚠️ Level B が下にある
Transport(4)                      ← OK（Level C）
```

### 推奨の変更

| 変更 | 理由 |
|------|------|
| **ShiftStatusBar を Hero の上に追加** | 責任状態が最初に見える（Phase 0.5） |
| **NextAction + Users を Briefing の上に移動** | 行動の入口（Level B）が周辺情報（Level C）より上 |
| **Attendance + Briefing を下に移動** | 補助情報は行動の後に見る |
| **EndOfDayChecklist を最下段に追加** | 朝は邪魔にならず、夕方に自然に見える（Phase 4） |

### 移動の優先順位

```
Phase 0.5  ShiftStatusBar を Hero の上に追加
Phase 2    レイアウト順序を Level A → B → C に再配置
Phase 4    EndOfDayChecklist + Closing Ack を最下段に追加
```

> [!TIP]
> Phase 1 の段階ではレイアウト変更は不要。
> Phase 0.5 で ShiftStatusBar を追加するときに、同時に順序を整理するのが効率的。

---

## やってはいけない配置（アンチパターン）

### ❌ 1. 一覧を最上段に置く

```
❌ TaskList (一覧)
   Hero
   NextAction
```

**理由**: 情報量が多くて朝から疲れる。最初にほしいのは「まずこれ」の1つ。

### ❌ 2. 終業確認を上に置く

```
❌ EndOfDayChecklist
   Hero
   TaskList
```

**理由**: 朝から「終わりましたか？」と聞かれると圧迫感。終業確認は夕方に効けば十分。

### ❌ 3. 全カードを同格に置く

```
❌ Attendance | Briefing | NextAction | Transport
   同じサイズ、同じ余白、同じ強調
```

**理由**: ダッシュボードとしてはきれいでも、「どれを先に見るか」が分からない。

---

## 夕方の強調変更（Phase 2 連携）

位置は変えず、**強調だけ変える**のが安全。

| 時間帯 | 変更 |
|--------|------|
| 朝（〜12:00） | Hero を強調、EndOfDayChecklist は淡い表示 |
| 昼（12:00〜16:00） | 通常表示 |
| 夕方（16:00〜） | EndOfDayChecklist を expand、Closing Ack を primary color に変更、Hero の文言を「残り確認項目」に |

> [!CAUTION]
> 位置の動的変更は混乱を招く。強調レベルの変更にとどめる。

---

## タブレット最適化

福祉現場はタブレット利用率が高い（iPad 9.7" / 10.2"）。

| 原則 | 理由 |
|------|------|
| **親指が届く中央に行動系を置く** | QuickRecord, NextAction は押す頻度が高い |
| **左上に状況系を固定** | ShiftStatusBar, Hero は「見る」もの |
| **スクロールなしで Level A が見える** | first viewport に ShiftStatusBar + Hero + Focus |

---

## ファイル構成（実装時の指針）

```
src/features/today/
├── layouts/
│   └── TodayBentoLayout.tsx       ← レイアウト統括（ここだけ変える）
├── widgets/
│   ├── ShiftStatusBar.tsx         ← 🆕 Phase 0.5
│   ├── HeroUnfinishedBanner.tsx   ← 既存
│   ├── FocusAlert.tsx             ← 🆕 Phase 3
│   ├── NextActionCard.tsx         ← 既存
│   ├── UserCompactList.tsx        ← 既存
│   ├── AttendanceSummaryCard.tsx   ← 既存
│   ├── BriefingActionList.tsx     ← 既存
│   ├── TodayServiceStructureCard.tsx ← 既存
│   ├── TransportStatusCard.tsx    ← 既存
│   └── EndOfDayChecklist.tsx      ← 🆕 Phase 4
└── hooks/
    ├── useCurrentShift.ts         ← 🆕 Phase 0.5
    └── useClosingAck.ts           ← 🆕 Phase 4（30行）
```

> [!NOTE]
> `TodayBentoLayout.tsx` がウィジェット配置の単一責任。
> 個別ウィジェットは props のみで駆動し、配置を知らない（既存の guardrails と一致）。

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-10 | 初版作成。「現場の思考順」に基づくレイアウト指示書 |

---

*関連: [TodayOps ロードマップ](./todayops-roadmap.md) / [Today ガードレール](./today-guardrails.md) / [TodayOps 技術仕様](./todayops.md)*
