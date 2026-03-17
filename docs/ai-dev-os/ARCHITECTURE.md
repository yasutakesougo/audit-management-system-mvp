# イソカツ AI Dev OS — Architecture Overview

> **AIで回る開発運用システム** — 観測 → 判断 → 実行 → 記録 の自律ループ

---

## System Architecture

```mermaid
graph TB
    subgraph NIGHT["🌙 深夜 (自動)"]
        NP["Nightly Patrol<br/>コード品質スキャン"]
        NM["OS Metrics<br/>Health Score 算出"]
        NP --> NM
    end

    subgraph MORNING["🌅 朝 (判断)"]
        TR["/triage<br/>🔴を1件選ぶ"]
    end

    subgraph DAY["☀️ 日中 (開発)"]
        direction TB
        subgraph P0["Phase 0 — Scan"]
            SC["/scan"]
        end
        subgraph P1["Phase 1 — Define"]
            DF["/define"]
        end
        subgraph P2["Phase 2 — Design"]
            AR["/architect"]
            DS["/design"]
            SP["/sp-schema"]
            PS["/plan-sheet"]
            RD["/record-design"]
        end
        subgraph P3["Phase 3 — Build"]
            IM["/implement"]
            PA["/powerapps"]
            FL["/flow"]
            RF["/react-feature"]
            CT["/cursor-task"]
        end
        subgraph P4["Phase 4 — Verify"]
            RV["/review"]
            FT["/fortress"]
            CP["/compliance"]
            TS["/test"]
            TD["/test-design"]
            UX["/ux-review"]
            DB["/debug"]
        end
        subgraph P5["Phase 5 — Package"]
            IS["/issue"]
            PR["/pr"]
            DC["/docs"]
            RC["/refactor"]
            RP["/refactor-plan"]
        end
    end

    subgraph EVENING["🌆 終業 (記録)"]
        HO["/handoff<br/>docs/handoff/"]
    end

    NM -->|レポート確認| TR
    TR -->|Issue化| IS
    TR -->|調査| SC
    SC --> DF --> DS --> IM --> RV --> PR
    PR --> HO
    HO -->|翌日| NP

    style NIGHT fill:#1a1a2e,color:#e0e0ff
    style MORNING fill:#ff6b35,color:white
    style DAY fill:#f0f0f0,color:#333
    style EVENING fill:#2d3436,color:#dfe6e9
```

---

## The Loop (PDCA)

```mermaid
graph LR
    P["🔵 Plan<br/>/define<br/>/design"] --> D["🟢 Do<br/>/implement<br/>/cursor-task"]
    D --> C["🟡 Check<br/>Nightly Patrol<br/>OS Metrics"]
    C --> A["🔴 Act<br/>/triage<br/>/issue"]
    A --> P

    style P fill:#2196F3,color:white
    style D fill:#4CAF50,color:white
    style C fill:#FF9800,color:white
    style A fill:#F44336,color:white
```

---

## Command Map (26 Commands)

| Phase | Commands | Purpose |
|:-----:|----------|---------|
| **0** | `/scan` `/triage` | 既存コード理解 / 朝の巡回判断 |
| **1** | `/define` | 曖昧 → 要件 |
| **2** | `/architect` `/design` `/sp-schema` `/plan-sheet` `/record-design` | 設計 |
| **3** | `/implement` `/powerapps` `/flow` `/react-feature` `/cursor-task` | 実装 |
| **4** | `/review` `/fortress` `/compliance` `/test` `/test-design` `/ux-review` `/debug` | 検証 |
| **5** | `/issue` `/pr` `/handoff` `/docs` `/refactor` `/refactor-plan` | 資産化 |

---

## Technology Coverage

```mermaid
graph LR
    subgraph OS["AI Dev OS"]
        direction TB
        W["26 Workflows"]
        R["5 Rules"]
        P["Nightly Patrol"]
        M["Metrics Dashboard"]
    end

    OS --- R1["React 18<br/>TypeScript 5<br/>MUI v5"]
    OS --- R2["Power Apps<br/>Power Automate"]
    OS --- R3["SharePoint<br/>Online"]
    OS --- R4["福祉制度<br/>ISP / 監査"]
    OS --- R5["GitHub<br/>Actions / CI"]

    style OS fill:#6c5ce7,color:white
    style R1 fill:#00b894,color:white
    style R2 fill:#0984e3,color:white
    style R3 fill:#00cec9,color:white
    style R4 fill:#e17055,color:white
    style R5 fill:#636e72,color:white
```

---

## Health Score

```
Score = 100
        − (巨大ファイル × 5)
        − (any使用 × 2)
        − (テスト未整備 × 3)
        − (TODO/FIXME × 1, max 10)
        + (Handoff実施 × 5)
```

| Grade | Score | 意味 |
|:-----:|:-----:|------|
| **A** | 80-100 | 健全。運用が回っている |
| **B** | 60-79 | 良好。改善が進んでいる |
| **C** | 40-59 | 注意。技術負債が蓄積中 |
| **D** | 20-39 | 警告。放置すると事故リスク |
| **F** | 0-19 | 危険。即対応が必要 |

---

## Daily Rhythm

```
 03:00  nightly-health.yml   テスト・ビルド確認
 03:15  nightly-patrol.yml   コード品質スキャン + ダッシュボード生成
         ↓
 08:30  /triage              レポート確認 → 🔴 を1件選択
         ↓
 09:00  /scan → /define      調査 → 要件定義
         ↓
 10:00  /design → /implement 設計 → 実装
         ↓
 16:00  /review → /fortress  レビュー → 硬化チェック
         ↓
 17:00  /pr → /handoff       PR作成 → 引き継ぎ記録
         ↓
 03:15  Nightly Patrol       翌日のスキャン
```

---

## Core Principles

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Code later** | まず要件を分解する |
| 2 | **Separate first** | UI / state / data / 業務ルールを混ぜない |
| 3 | **Audit-ready** | 「動く」だけでは不十分。制度・監査まで |
| 4 | **Role, not task** | AIには「作業」ではなく「責務と出力形式」を渡す |
| 5 | **Always asset** | 毎回 Issue / PR / 手順書に落とす |

---

## Evolution

```
v1    26 Workflows + 5 Rules        ← 開発OS
v2    Nightly Patrol + Metrics      ← 観測OS
v2.5  /triage + /handoff 運用安定   ← 運用OS  ◀ 現在地
v3    AI提案エンジン                ← 自律OS（次）
```

---

> *Built for [イソカツ](https://github.com/yasutakesougo/audit-management-system-mvp) — 福祉事業所の現場OS*
