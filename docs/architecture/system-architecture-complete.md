# 支援業務 OS — 完成アーキテクチャ図

> **Audit Management System MVP**
> 障害福祉サービスの支援業務を PDCA サイクルとしてコード化した基盤システム

---

## 全体像

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          支援業務 OS                                       │
│                                                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│  │  Today    │    │Dashboard │    │ Handoff  │    │ Schedule │            │
│  │  /today   │    │ /dash    │    │/handoff  │    │/schedules│            │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘            │
│       │               │               │               │                   │
│       └───────────────┴───────────┬───┴───────────────┘                   │
│                                   │                                       │
│                          統合ダッシュボード層                              │
│                                   │                                       │
│  ┌────────────────────────────────┼────────────────────────────────────┐  │
│  │                      PDCA 支援基盤                                  │  │
│  │                                │                                    │  │
│  │  ┌─────────────────────────────┼─────────────────────────────────┐  │  │
│  │  │                     ISP 三層モデル                             │  │  │
│  │  │                             │                                  │  │  │
│  │  │   ┌─────────┐    ┌─────────┴──────┐    ┌──────────────────┐  │  │  │
│  │  │   │   L1    │    │      L2        │    │       L3         │  │  │  │
│  │  │   │  ISP    │───▶│ 支援計画シート  │───▶│ 手順書兼記録     │  │  │  │
│  │  │   │(Why)    │    │ (How)          │    │ (Do + Record)    │  │  │  │
│  │  │   └─────────┘    └───────┬────────┘    └──────────────────┘  │  │  │
│  │  │                          │                                    │  │  │
│  │  │              ┌───────────┼───────────┐                        │  │  │
│  │  │              │     三ブリッジ        │                        │  │  │
│  │  │              │                       │                        │  │  │
│  │  │              │  Bridge1: Assess→L2   │                        │  │  │
│  │  │              │  Bridge2: L2→L3       │                        │  │  │
│  │  │              │  Bridge3: Monitor→L2  │                        │  │  │
│  │  │              │                       │                        │  │  │
│  │  │              └───────────────────────┘                        │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────────┐   │  │
│  │  │ Monitoring       │  │ Provenance   │  │ Regulatory          │   │  │
│  │  │ Schedule         │  │ Tracking     │  │ Dashboard           │   │  │
│  │  │ (supportStart    │  │ (出典追跡)    │  │ (制度遵守チェック)  │   │  │
│  │  │  Date 起点)      │  │              │  │                     │   │  │
│  │  └──────────────────┘  └──────────────┘  └─────────────────────┘   │  │
│  │                                                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     安全管理基盤                                     │  │
│  │                                                                     │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │ 危機対応 │  │ 身体拘束記録 │  │ 適正化   │  │ 研修記録     │   │  │
│  │  │ P0-1     │  │ P0-2         │  │  委員会  │  │              │   │  │
│  │  └──────────┘  └──────────────┘  └──────────┘  └──────────────┘   │  │
│  │                                                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ 指針版管理 (GuidelineVersion)                                │   │  │
│  │  │ 必須7項目チェック + 版履歴                                    │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PDCA サイクル完全図

```
              ┌─────────────────────────────┐
              │         PLAN (計画)          │
              │                             │
              │  L1: ISP (生活全体の方向性)  │
              │         │                   │
              │  Bridge1: Assessment→L2     │
              │         ▼                   │
              │  L2: 支援計画シート          │
              │      (行動・支援設計)        │
              │         │                   │
              │  Bridge2: L2→L3            │
              │         ▼                   │
              │  L3: 手順書兼記録           │
              │      (手順化)               │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │         DO (実施)           │
              │                             │
              │  Daily 画面                 │
              │    手順に沿った支援実施      │
              │    ABC 行動記録              │
              │    実施チェック              │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │        CHECK (評価)          │
              │                             │
              │  BehaviorMonitoringRecord   │
              │    支援評価 (有効/一部/無効) │
              │    環境所見                  │
              │    新トリガー発見            │
              │    困難場面記録              │
              │                             │
              │  Monitoring Schedule        │
              │    supportStartDate 起点    │
              │    90日サイクル             │
              │    進捗・超過アラート        │
              └──────────┬──────────────────┘
                         │
                         ▼
              ┌─────────────────────────────┐
              │         ACT (改善)          │
              │                             │
              │  Bridge3: Monitor→L2       │
              │    自動追記:                │
              │      overallAssessment      │
              │      userFeedback           │
              │      changeReason           │
              │    候補提示:                │
              │      goalEvaluations ☑      │
              │      decisions ☑            │
              │                             │
              │  → L2 支援計画シート更新    │
              │  → 次サイクルへ             │
              └─────────────────────────────┘
```

---

## コード構造マップ

### ドメイン層 (`src/domain/`)

```
domain/
├── isp/                          # ISP 三層モデル中核
│   ├── schema.ts                 # Zod スキーマ + 全型定義
│   ├── types.ts                  # 状態遷移・監査証跡・版管理
│   ├── port.ts                   # Repository Port ×3
│   ├── behaviorMonitoring.ts     # L2 行動モニタリング型
│   ├── planningSheetVersion.ts   # 版管理ドメインロジック
│   └── bridge/                   # Daily 連携 Adapter
│       ├── toDailyProcedureSteps.ts
│       ├── resolveProcedureSteps.ts
│       └── toProcedureRecord.ts
│
├── regulatory/                   # 制度遵守チェックエンジン
│   ├── auditChecks.ts            # Finding 生成ルール
│   ├── buildFindingActions.ts    # Finding → アクション URL
│   ├── findingEvidenceSummary.ts # Finding → 根拠解決
│   ├── aggregateIcebergEvidence.ts
│   ├── userRegulatoryProfile.ts
│   └── staffQualificationProfile.ts
│
├── safety/                       # 安全管理ドメイン
│   ├── complianceCommittee.ts    # 適正化委員会
│   ├── guidelineVersion.ts       # 指針版管理
│   ├── trainingRecord.ts         # 研修記録
│   ├── physicalRestraint.ts      # 身体拘束記録
│   ├── complianceRepository.ts   # Port: 委員会+指針+研修
│   └── restraintRepository.ts    # Port: 身体拘束
│
├── assessment/                   # アセスメント
├── behavior/                     # 行動記録
├── daily/                        # 日次記録
└── support/                      # 支援活動
```

### Feature 層 (`src/features/`)

```
features/
├── planning-sheet/               # L2 支援計画シート
│   ├── assessmentBridge.ts         # Bridge1: Assessment → L2
│   ├── planningToRecordBridge.ts   # Bridge2: L2 → L3
│   ├── monitoringToPlanningBridge.ts # Bridge3: Monitor → L2
│   ├── monitoringSchedule.ts       # L2 モニタリング周期
│   ├── components/
│   │   ├── ImportAssessmentDialog.tsx   # Bridge1 UI
│   │   ├── ImportMonitoringDialog.tsx   # Bridge3 UI
│   │   ├── ProvenanceBadge.tsx          # 出典バッジ
│   │   ├── ImportHistoryTimeline.tsx    # 取込履歴
│   │   ├── EditableIntakeSection.tsx
│   │   └── EditableOverviewSection.tsx
│   ├── hooks/
│   │   └── usePlanningSheetForm.ts
│   └── stores/
│       └── importAuditStore.ts          # 監査メモ
│
├── daily/                        # L3 日次支援
│   ├── components/
│   │   └── procedure/
│   │       └── ImportPlanningDialog.tsx  # Bridge2 UI
│   ├── domain/
│   └── hooks/
│
├── support-plan-guide/           # L1 ISP 画面
│   ├── hooks/
│   │   ├── useSupportPlanBundle.ts      # 本番データ取得
│   │   ├── useRegulatorySummary.ts      # 制度サマリー
│   │   └── useIspRepositories.ts        # DI
│   └── components/
│
├── ibd/analysis/pdca/            # Iceberg PDCA 分析
│
├── safety/                       # 安全管理 UI
│   ├── components/
│   │   ├── ComplianceDashboard.tsx
│   │   ├── IncidentHistoryList.tsx
│   │   └── RestraintHistoryList.tsx
│   └── hooks/
│       └── useSafetyOperationsSummary.ts
│
├── dashboard/                    # ダッシュボード
├── today/                        # Today 画面
├── handoff/                      # 申し送り
├── schedules/                    # スケジュール
├── import/                       # CSV インポート
├── records/                      # 月次記録
└── ...                           # (40+ features)
```

### Infrastructure 層

```
infra/
├── localStorage/                 # 開発/デモ用 永続化
│   ├── localComplianceRepository.ts    # 委員会+指針+研修
│   ├── localRestraintRepository.ts     # 身体拘束
│   ├── localIncidentRepository.ts      # 危機対応
│   ├── localMonitoringMeetingRepository.ts
│   ├── localPlanningSheetVersionRepository.ts
│   └── localStaffQualificationRepository.ts
│
├── firestore/                    # 認証
│   ├── auth.ts
│   └── client.ts
│
└── sharepoint/                   # 本番データ
    └── repos/

data/isp/sharepoint/              # ISP 三層 SharePoint Adapter
├── SharePointIspRepository.ts
├── SharePointPlanningSheetRepository.ts
├── SharePointProcedureRecordRepository.ts
└── mapper.ts
```

---

## データフロー完全図

```
                    ┌─────────────────────────────────────┐
                    │          SharePoint Lists            │
                    │  ISP │ PlanningSheet │ ProcedureRec  │
                    │  PDCA │ Users │ Staff │ Schedules    │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┼──────────────────────┐
                    │       Repository Ports               │
                    │  ISP │ PlanningSheet │ ProcedureRec  │
                    │  PDCA │ Compliance │ Restraint       │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────────┐
              │                    │                        │
              ▼                    ▼                        ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │ useSupportPlan   │ │ useIceberg       │ │ useSafety        │
    │ Bundle           │ │ Evidence         │ │ Operations       │
    │ (ISP+L2+L3)      │ │ (PDCA分析)       │ │ Summary          │
    └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
             │                    │                     │
             ▼                    ▼                     ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │useRegulatory     │ │ aggregate        │ │ Compliance       │
    │Summary           │ │ IcebergEvidence  │ │ Dashboard        │
    │ (制度集約)        │ │ (根拠集約)        │ │ (安全管理)       │
    └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
             │                    │                     │
             └────────────┬───────┘                     │
                          │                             │
             ┌────────────┼─────────────────────────────┼───┐
             │            │         画面層              │   │
             │  ┌─────────┴──────┐  ┌──────────────────┴─┐ │
             │  │ SupportPlan    │  │ Regulatory         │ │
             │  │ GuidePage (L1) │  │ Dashboard          │ │
             │  └────────────────┘  └────────────────────┘ │
             │  ┌────────────────┐  ┌────────────────────┐ │
             │  │ SupportPlanning│  │ Daily              │ │
             │  │ SheetPage (L2) │  │ Page (L3)          │ │
             │  └────────────────┘  └────────────────────┘ │
             │  ┌────────────────┐  ┌────────────────────┐ │
             │  │ Today          │  │ Dashboard          │ │
             │  │ OpsPage        │  │ Page               │ │
             │  └────────────────┘  └────────────────────┘ │
             └─────────────────────────────────────────────┘
```

---

## 三ブリッジ詳細

### Bridge 1: Assessment → Planning Sheet

```
┌────────────────┐     assessmentBridge()      ┌─────────────────────┐
│  Assessment    │ ──────────────────────────▶  │ L2 支援計画シート   │
│  (ICF分類)     │   formPatches:               │                     │
│  (特性アンケ)   │     observationFacts         │  ImportAssessment   │
│                │     interpretationHypothesis  │  Dialog.tsx         │
│                │   intakePatches:              │                     │
│                │     sensoryTriggers           │  2モード:            │
│                │     medicalFlags              │  assessment-only    │
│                │     communicationModes        │  with-tokusei       │
│                │   provenance[ ]:              │                     │
│                │     field + source + reason  │  確認表示付き        │
└────────────────┘                              └─────────────────────┘
```

### Bridge 2: Planning Sheet → Procedure Record

```
┌─────────────────────┐  planningToRecordBridge()  ┌──────────────────┐
│ L2 支援計画シート   │ ────────────────────────▶  │ L3 手順書兼記録  │
│                     │  steps[]:                   │                  │
│ supportPolicy       │    activity: 支援方針      │ ImportPlanning    │
│ concreteApproaches  │    activity: 具体的対応    │ Dialog.tsx        │
│ environmental       │    activity: 環境調整      │                  │
│ Adjustments         │  globalNotes:              │ プレビュー       │
│                     │    sensoryTriggers         │ 重複排除         │
│ intake.sensory      │    medicalFlags            │ provenance       │
│ intake.medical      │  provenance[ ]             │                  │
└─────────────────────┘                            └──────────────────┘
```

### Bridge 3: Monitoring → Planning Sheet

```
┌─────────────────────┐  monitoringToPlanning()   ┌─────────────────────┐
│ BehaviorMonitoring  │ ───────────────────────▶  │ L2 支援計画シート   │
│ Record              │                            │                     │
│                     │  自動追記 (確認のみ):       │  ImportMonitoring   │
│ overallAssessment   │    overallAssessment       │  Dialog.tsx         │
│ supportEvaluations  │    userFeedback            │                     │
│ environmentFindings │    changeReason            │  選択式:            │
│ difficultiesObserved│                            │  ☑ effective_support│
│ newTriggers         │  候補提示 (チェックボックス):│  ☑ environment      │
│ recommendedChanges  │    goalEvaluations         │  ☐ revision_needed  │
│ userFeedback        │    decisions               │  ☐ policy           │
│ familyFeedback      │                            │                     │
└─────────────────────┘  provenance[]: 🟠 warning  └─────────────────────┘
```

---

## 出典追跡 (Provenance) システム

```
取込操作
    │
    ├─ ProvenanceEntry              ← 各フィールドの出典
    │    field: "observationFacts"
    │    source: "assessment_icf"
    │    reason: "ICF b710 関節可動域"
    │    value: "左膝関節拘縮あり"
    │
    ├─ ImportAuditRecord            ← 操作の監査ログ
    │    mode: "assessment-only" | "with-tokusei" | "behavior-monitoring"
    │    affectedFields: [...]
    │    planningSheetId
    │
    ├─ ProvenanceBadge              ← UI 表示
    │    🔵 assessment     [ICF]
    │    🟢 tokusei        [特性]
    │    🟠 monitoring     [モニタ]
    │
    └─ ImportHistoryTimeline        ← 取込履歴一覧
         3モード色分け表示
```

---

## モニタリングスケジュール

```
                 supportStartDate
                       │
                       ▼
    ┌──── Cycle 1 (90日) ────┬──── Cycle 2 (90日) ────┬──── ...
    │                        │                        │
    │   経過45日 (50%)       │                        │
    │   [■■■■■░░░░░]         │                        │
    │                        │                        │
  start                   next                     next+90
                       monitoring                monitoring
                         date                      date

  色分け:
    🔵 info     残り15日以上
    🟠 warning  残り14日以内
    🔴 error    期限超過
```

---

## テスト構造

| 層 | テストファイル数 | テスト数 |
|---|---|---|
| Domain: ISP | 5+ files | ~80 |
| Domain: Regulatory | 5 files | ~70 |
| Domain: Safety | 2 files | ~45 |
| Feature: Bridges | 4 files | ~50 |
| Feature: Planning Sheet | 5+ files | ~100 |
| Feature: Support Plan Guide | 5+ files | ~50 |
| Infra: localStorage | 2+ files | ~25 |
| Integration | 5+ files | ~40 |
| **合計** | **33+ files** | **~460** |

---

## 技術スタック

```
Frontend:   React 18 + TypeScript + Vite
UI:         MUI (Material UI)
State:      React Query + Zustand
Schema:     Zod
Backend:    SharePoint REST API (Microsoft 365)
Auth:       Firebase Auth / MSAL
Testing:    Vitest + Testing Library
CI:         GitHub Actions
Lint:       ESLint + Prettier + husky
Docs:       ADR + Architecture Docs
```

---

## アーキテクチャ原則

### Ports & Adapters

```
Domain (Pure)  ←→  Port (Interface)  ←→  Adapter (Infrastructure)
                                              │
                                    ┌─────────┼──────────┐
                                    │         │          │
                                LocalStorage  SharePoint  InMemory
                                 (開発/デモ)   (本番)     (テスト)
```

### 層間参照ルール

| 方向 | 許可 | 理由 |
|------|------|------|
| L1 → L2 | ✅ 参照表示 | ISP 画面でシート一覧を表示 |
| L2 → L3 | ✅ Bridge2 | 手順化は設計の具体化 |
| L3 → L2 | ❌ 編集不可 | 支援設計の変更はシート画面で |
| Monitor → L2 | ✅ Bridge3 | PDCA の C→A (候補提示のみ) |
| Dashboard → 全層 | ✅ 読取専用 | 横断チェック |

### ADR (Architecture Decision Records)

| ADR | 決定事項 |
|---|---|
| ADR-005 | ISP 三層分離 |
| ADR-006 | 画面責務境界 |
| ADR-007 | Assessment → Planning → Record ブリッジ |

---

> **This system is not just a support record app.**
> **It is a Support Operations OS that codifies the PDCA cycle of welfare services.**
