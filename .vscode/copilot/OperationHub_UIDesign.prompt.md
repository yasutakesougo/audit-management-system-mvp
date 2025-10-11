<!--
title: 福祉事業所向けスケジュール管理システム UI/UX設計・開発仕様
description: 障がい福祉事業所向けのスケジュール管理システム（オペレーションハブ）のUI設計、推奨ファイル構成、および既存システムアーキテクチャ定義。
context: React, TypeScript, Vite, SharePoint Framework (SPFx), Fluent UI, MUI, MSAL, SharePoint REST API, Human-Centered Design
tags: UI/UX, SPFx, React, Mockup, Requirement Definition, Architecture, MSAL, useSP
-->


# プロジェクトコンテキスト：福祉事業所向けスケジュール管理システム UI設計

本ドキュメントは、利用者約30名、職員約20名が利用する障がい福祉事業所の複雑なスケジュール管理課題を解決するためのUI/UX設計、推奨されるReactファイル構成、および既存のシステムアーキテクチャ（React + SharePoint SPA）を定義する。

## 目次

1. [設計の核心思想と原則](#section-core-principles)
2. [技術スタックとデザインシステム](#section-tech-stack)
  1. [推奨ファイル構成](#section-file-structure)
  2. [デザイントークンとテーマ](#section-design-tokens)
3. [ユーザーペルソナと要求](#section-personas)
  1. [代表タスクとKPI](#section-personas-kpi)
4. [UIデザイン提案](#section-ui-design)
  1. [全体構造とナビゲーション](#section-layout-nav)
  2. [ダッシュボード](#section-dashboard)
  3. [マスタースケジュール](#section-master-schedule)
  4. [予定追加モーダル](#section-schedule-modal)
  5. [モバイルビュー](#section-mobile-view)
5. [現状システム情報と開発ガイドライン](#section-existing-system)
6. [情報アーキテクチャとナビゲーションマップ](#section-information-architecture)
7. [主要ユースケース別ユーザーフロー](#section-user-flows)
8. [インタラクション設計と状態管理](#section-interaction)
9. [SPFx/SharePoint連携アーキテクチャ](#section-spfx-architecture)
10. [データモデルとAPIコントラクト](#section-data-model)
11. [アクセシビリティと国際化ガイドライン](#section-a11y-i18n)
12. [性能・運用監視と品質指標](#section-performance)
13. [リリース計画と段階的導入](#section-roadmap)
14. [開発プロセスとワークフロー](#section-process)
15. [付録](#section-appendix)

<a id="section-core-principles"></a>
## 1. 設計の核心思想と原則

目標は、スケジュール管理システムを「静的な記録簿」から「動的なオペレーションハブ」へと昇華させること。

### 基本原則
1.  **統一された情報源（One Source of Truth）**: シフト、予定、記録、請求情報を単一のインターフェースで統合管理。
2.  **役割ベースの最適化（Role-Based Optimization）**: ペルソナ（施設長、常勤、非常勤）に対し、最適化された画面と機能を提供。
3.  **能動的なエラー防止（Proactive Error Prevention）**: ダブルブッキング等を、入力段階で未然に防ぐガイド機能と視覚的フィードバックを提供。
4.  **人間中心設計 (Human-Centered Design):** 特に現場職員の操作性を最優先し、「迷わない」「素早く操作できる」UIを目指す。

<a id="section-tech-stack"></a>
## 2. 技術スタックとデザインシステム

既存のシステム構成に基づき、以下の技術スタックを採用する。

*   **フロントエンド:** React 18 + TypeScript + Vite
*   **開発手法:** SharePoint Framework (SPFx) または スタンドアロンSPA
*   **認証:** MSAL (@azure/msal-browser, @azure/msal-react)
*   **デザインシステム:** Microsoft Fluent UI (`@fluentui/react`) および MUI (Material UI)
*   **アイコンライブラリ:** Material UI Icons (`@mui/icons-material`) ← 操作性向上のため全面的に採用
*   **バックエンド:** SharePoint Online リスト (SharePoint REST API経由)

<a id="section-file-structure"></a>
## 2.1. 推奨されるファイル構成 (React ベストプラクティス)

React開発では、機能やコンポーネントごとにファイルを分割することが推奨される。これにより、保守性、再利用性、可読性が向上する。

```plaintext
src/
├── app/               // シェル、ルーティング、テーマ
├── auth/              // MSAL設定とフック (既存)
├── features/          // 機能ごとのモジュール
│   ├── audit/         // 監査ログ機能 (既存)
│   ├── dashboard/     // ダッシュボード機能 (新規)
│   │   ├── components/
│   │   │   ├── KpiCard.tsx
│   │   │   └── TodaysEvents.tsx
│   │   └── routes/
│   │       └── Dashboard.tsx
│   ├── schedule/      // スケジュール管理機能 (新規/既存拡張)
│   │   ├── components/
│   │   │   └── ScheduleForm.tsx
│   │   └── routes/
│   │       ├── MasterSchedule.tsx
│   │       └── MobileAgendaView.tsx
│   └── users/         // 利用者管理 (既存)
├── lib/               // コアヘルパー (SharePointクライアント: useSP, 監査ログ) (既存)
└── ui/components/     // 汎用的な共通UI部品 (既存)
    ├── AppHeader.tsx
    └── shared/
```

<a id="section-design-tokens"></a>
## 2.2. デザイントークンとテーマガイド

| カテゴリ | トークン | 値 (例) | 使用箇所 | 備考 |
|----------|----------|---------|----------|------|
| Color | `color.primary` | `#0078D4` | プライマリボタン、リンク強調 | Fluent UI `theme.palette.themePrimary` と同期 |
| Color | `color.danger` | `#A80000` | 警告、競合アラート | アクセシビリティ比 5.4:1 |
| Color | `color.success` | `#107C10` | 成功トースト、完了タグ | WCAG AA 準拠 |
| Spacing | `space.xs` | `4px` | アイコンとテキスト間隔 | 4px グリッドの倍数 |
| Spacing | `space.md` | `12px` | カード内余白 | | 
| Radius | `radius.card` | `4px` | カード / モーダル | Fluent Design の丸み |
| Typography | `font.heading` | `'Segoe UI', 'Meiryo', sans-serif` | 見出し | `theme.fonts.xLarge` などへ紐づけ |
| Shadow | `shadow.card` | `0 1.6px 3.6px rgba(0,0,0,0.1)` | KPI カード | 影の段階は 2 レベルまで |

- すべてのトークンは `src/app/theme.tsx` で定義し、MUI `createTheme` と Fluent `ThemeProvider` のブリッジレイヤーを提供。
- ダークモード導入に備え、カラートークンは `semanticColors` 辞書で抽象化。
- Figma との同期は `tokens.json` (Style Dictionary) を将来的に追加し、自動エクスポートを検討。

<a id="section-personas"></a>
## 3. ユーザーペルソナと主要な要求

| ペルソナ | 役割と目標 | UIへの主要な要求 |
| :--- | :--- | :--- |
| **施設長** | 全体の運営管理、リソース最適配分、コンプライアンス確保。 | 全体を俯瞰できるダッシュボード、強力なフィルタリング、タイムライン（リソース）ビュー、レポーティング機能。 |
| **常勤職員** | 日々の支援業務、記録、情報共有。 | シンプルな個人用ビュー（マイデイ）、スマートフォン完全対応、予定と支援記録のシームレスな連携。 |
| **非常勤職員**| 定められた時間内での支援業務、報告。 | アイコン中心の直感的UI、モバイルファースト設計、ワンタップでのアクション実行（記録・打刻）、アクセス制限。 |

<a id="section-personas-kpi"></a>
### 3.1. 代表タスクとKPI

| ペルソナ | 代表タスク | 成功指標 (KPI) | 現状課題 | 改善アイデア |
|-----------|------------|---------------|-----------|--------------|
| 施設長 | 当日のリソース配分確認、競合解消、レポートエクスポート | 競合解消時間 ≤ 5分、未割り当て依頼ゼロ | 複数ツール横断が必要 | ダッシュボードで一元化、フィルタプリセット保存 |
| 常勤職員 | 日次記録入力、予定の確認と更新 | 記録未提出件数ゼロ、予定確認時間 ≤ 2分 | 外出時のモバイル操作が煩雑 | 大きなタップ領域、音声入力補助、オフライン下書き |
| 非常勤職員 | 送迎チェックイン、緊急連絡対応 | 遅延報告件数 -30%、通知到達率 95% | スマホ操作不慣れ、通知見落とし | アイコン中心 UI、バイブ通知、タスク順序自動並び替え |

<a id="section-ui-design"></a>
## 4. UIデザイン提案（モックアップ）

<a id="section-layout-nav"></a>
### 4.1. 全体構造とナビゲーション

Fluent UI/MUIの標準レイアウトを採用。左側に固定ナビゲーション、上部にヘッダー。

```svg
<svg width="1000" height="500" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="font-family: 'Segoe UI', 'Meiryo UI', sans-serif;">
  <rect width="1000" height="500" fill="#F3F2F1"/>

  <header>
    <rect width="1000" height="48" fill="#0078D4"/>
    <text x="20" y="30" fill="white" font-size="18" font-weight="bold">福祉事業所 オペレーションハブ</text>
    <g transform="translate(700, 8)">
      <rect width="200" height="32" fill="white" rx="2" opacity="0.9"/>
      <text x="10" y="20" font-size="14" fill="#323130">🔍 統合検索</text>
    </g>
    <rect x="900" y="8" width="80" height="32" fill="#FFFFFF" rx="4"/>
    <text x="940" y="28" text-anchor="middle" font-size="14px" fill="#0078D4">Sign In</text>
  </header>

  <nav>
    <rect x="0" y="48" width="220" height="452" fill="#FFFFFF"/>
    <rect x="0" y="58" width="220" height="40" fill="#EDEBE9"/>
    <rect x="0" y="58" width="4" height="40" fill="#0078D4"/>
    <text x="20" y="82" font-size="14px" font-weight="600" fill="#0078D4">🏠 ホーム（ダッシュボード）</text>
    <text x="20" y="122" font-size="14px">📅 スケジュール</text>
    <text x="20" y="162" font-size="14px">🧑‍利用者管理 (/users)</text>
    <text x="20" y="202" font-size="14px">🧑‍職員管理</text>
    <text x="20" y="242" font-size="14px">📊 レポート</text>
    <text x="20" y="420" font-size="14px">📋 監査ログ (/audit)</text>
    <text x="20" y="470" font-size="14px">⚙️ 設定</text>
  </nav>

  <main>
    <rect x="240" y="70" width="740" height="410" fill="#FFFFFF" rx="4" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
     <text x="260" y="100" font-size="20px" font-weight="600">メインコンテンツエリア</text>
  </main>
</svg>
```

<a id="section-dashboard"></a>
### 4.2. ダッシュボード（施設長向け）

「作戦司令室」として機能。KPI（人員充足率、未割り当て依頼）、緊急度に応じたアラート、本日の重要イベントを表示。

```svg
<svg width="1000" height="600" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="font-family: 'Segoe UI', 'Meiryo UI', sans-serif; background-color: #F3F2F1;">
  <text x="20" y="40" font-size="24px" font-weight="600">ダッシュボード（施設長）</text>
  <text x="20" y="70" font-size="14px" fill="#605E5C">2025年10月5日（日）の状況</text>

  <g transform="translate(20, 90)">
    <rect width="310" height="120" rx="4" fill="white" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
    <text x="15" y="25" font-size="16px" font-weight="600">本日の職員配置充足率</text>
    <text x="150" y="80" font-size="48px" font-weight="600" fill="#107C10" text-anchor="middle">95%</text>
    <text x="15" y="105" font-size="12px" fill="#605E5C">必要人数: 15 / 配置済: 14.25</text>
  </g>

  <g transform="translate(345, 90)">
    <rect width="310" height="120" rx="4" fill="white" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
    <text x="15" y="25" font-size="16px" font-weight="600">未割り当ての依頼</text>
    <text x="150" y="80" font-size="48px" font-weight="600" fill="#A80000" text-anchor="middle">3件</text>
    <text x="15" y="105" font-size="12px" fill="#0078D4" style="text-decoration: underline; cursor: pointer;">詳細を確認し割り当てる</text>
  </g>

  <g transform="translate(670, 90)">
    <rect width="310" height="120" rx="4" fill="white" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
    <text x="15" y="25" font-size="16px" font-weight="600">承認待ちの申請（休暇・シフト変更）</text>
    <text x="150" y="80" font-size="48px" font-weight="600" text-anchor="middle">5件</text>
  </g>

  <g transform="translate(20, 230)">
     <text font-size="18px" font-weight="600">アラートと通知</text>
  </g>
  <g transform="translate(20, 260)">
    <rect width="960" height="50" rx="4" fill="#FDE7E9" stroke="#F7C9CC"/>
    <text x="15" y="30" font-size="16px" fill="#A80000">⚠️【要対応】</text>
    <text x="120" y="30" font-size="16px">利用者A様の受給者証が今月末で期限切れです。</text>
  </g>
  <g transform="translate(20, 320)">
    <rect width="960" height="50" rx="4" fill="#FFF4CE" stroke="#F7E2A3"/>
    <text x="15" y="30" font-size="16px" fill="#D83B01">❗【確認】</text>
    <text x="100" y="30" font-size="16px">職員Bさんの資格更新が必要です（期限：11/15）。</text>
  </g>

  <g transform="translate(20, 390)">
    <rect width="960" height="190" rx="4" fill="white" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
    <text x="15" y="25" font-size="18px" font-weight="600">本日の重要イベント</text>
    <line x1="15" y1="40" x2="945" y2="40" stroke="#EDEBE9"/>

    <g transform="translate(15, 50)">
        <text x="0" y="20" font-size="14px" fill="#605E5C">10:00</text>
        <circle cx="60" cy="18" r="6" fill="#D83B01"/>
        <line x1="60" y1="24" x2="60" y2="60" stroke="#D83B01" stroke-dasharray="4"/>
        <text x="75" y="20" font-size="16px" font-weight="600">ショートステイ退所：利用者C様</text>
        <text x="75" y="40" font-size="14px">担当：職員D、送迎：車両1号</text>
    </g>

    <g transform="translate(15, 110)">
        <text x="0" y="20" font-size="14px" fill="#605E5C">14:00</text>
        <circle cx="60" cy="18" r="6" fill="#107C10"/>
        <line x1="60" y1="24" x2="60" y2="60" stroke="#107C10" stroke-dasharray="4"/>
        <text x="75" y="20" font-size="16px" font-weight="600">一時ケア（外出支援）：利用者E様</text>
        <text x="75" y="40" font-size="14px">担当：非常勤F、リフト付き車両使用</text>
    </g>

     <g transform="translate(15, 170)">
        <text x="0" y="20" font-size="14px" fill="#605E5C">16:00</text>
        <circle cx="60" cy="18" r="6" fill="#D83B01"/>
        <text x="75" y="20" font-size="16px" font-weight="600">ショートステイ入所：利用者G様</text>
    </g>
  </g>
</svg>
```

<a id="section-master-schedule"></a>
### 4.3. マスタースケジュール：タイムライン（リソース）ビュー

中核機能。複雑なリソース（職員、車両）の重複と空き状況を一目で把握する。実装には `FullCalendar (Resource Timeline View)` 等の利用を想定。

  * **A. ビュー切替と日付選択。**
  * **B. フィルタリングパネル:** 左側に常設。サービス種別や雇用形態で絞り込み。
  * **C. リソース軸（縦）:** 職員（常勤・非常勤でグループ化）、車両。
  * **D. 時間軸（横）と予定バー:** サービス種別ごとの色分け（生活介護=青 \#0078D4、一時ケア=緑 \#107C10、ショートステイ=橙 \#D83B01、送迎=紫 \#B146C2）。
  * **E. 能動的なエラー防止（静的）:** 既存のダブルブッキングは赤く強調表示。
  * **F. 能動的なエラー防止（動的）:** ドラッグ＆ドロップ時、競合する場合は移動先の背景色でフィードバック。

```svg
<svg width="1200" height="600" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="font-family: 'Segoe UI', 'Meiryo UI', sans-serif; background-color: #F3F2F1;">

  <g transform="translate(20, 10)">
    <text x="0" y="30" font-size="24px" font-weight="600">マスタースケジュール (A)</text>

    <rect x="700" y="10" width="80" height="32" rx="2" fill="#0078D4"/>
    <text x="740" y="30" fill="white" text-anchor="middle">今日</text>

    <text x="800" y="30" font-size="18px">＜</text>
    <text x="880" y="30" font-size="16px" text-anchor="middle">2025年10月5日 (日)</text>
    <text x="960" y="30" font-size="18px">＞</text>

    <rect x="1000" y="10" width="180" height="32" rx="2" fill="white" stroke="#A19F9D"/>
    <text x="1020" y="30">タイムライン（日）</text>
    <text x="1160" y="30">▼</text>
  </g>

  <g transform="translate(20, 60)">
    <rect width="200" height="520" fill="white" rx="4" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>
    <text x="15" y="30" font-size="18px" font-weight="600">絞り込み (B)</text>
    <line x1="15" y1="45" x2="185" y2="45" stroke="#EDEBE9"/>

    <text x="15" y="70" font-size="16px" font-weight="600">サービス種別</text>
    <text x="15" y="100" font-size="14px">☑ 生活介護</text>
    <text x="15" y="130" font-size="14px">☑ 一時ケア</text>
    <text x="15" y="160" font-size="14px">☑ ショートステイ</text>
    <text x="15" y="190" font-size="14px">☑ 送迎</text>

    <text x="15" y="240" font-size="16px" font-weight="600">雇用形態</text>
    <text x="15" y="270" font-size="14px">☑ 常勤職員</text>
    <text x="15" y="300" font-size="14px">☑ 非常勤職員</text>

    <rect x="15" y="470" width="170" height="32" rx="2" fill="#0078D4"/>
    <text x="40" y="490" fill="white">自分の予定のみ表示</text>
  </g>

  <g transform="translate(240, 60)">
    <rect width="940" height="520" fill="white" rx="4" style="box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.1);"/>

    <rect width="940" height="50" fill="#F3F2F1"/>
    <text x="140" y="30" text-anchor="middle">09:00 (D)</text>
    <text x="260" y="30" text-anchor="middle">10:00</text>
    <text x="380" y="30" text-anchor="middle">11:00</text>
    <text x="500" y="30" text-anchor="middle">12:00</text>
    <text x="620" y="30" text-anchor="middle">13:00</text>
    <text x="740" y="30" text-anchor="middle">14:00</text>
    <text x="860" y="30" text-anchor="middle">15:00</text>
    <line x1="100" y1="0" x2="100" y2="520" stroke="#D2D0CE"/>

    <line x1="140" y1="50" x2="140" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="260" y1="50" x2="260" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="380" y1="50" x2="380" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="500" y1="50" x2="500" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="620" y1="50" x2="620" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="740" y1="50" x2="740" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>
    <line x1="860" y1="50" x2="860" y2="520" stroke="#E1DFDD" stroke-dasharray="2,2"/>

    <rect x="0" y="50" width="100" height="30" fill="#E1DFDD"/>
    <text x="10" y="70" font-weight="600">▼ 常勤</text>

    <text x="10" y="105">山田（施設長）</text>
    <line x1="0" y1="120" x2="940" y2="120" stroke="#EDEBE9"/>
    <text x="10" y="145">佐藤 花子</text>
    <line x1="0" y1="160" x2="940" y2="160" stroke="#EDEBE9"/>
    <text x="10" y="185">鈴木 一郎</text>
    <line x1="0" y1="200" x2="940" y2="200" stroke="#EDEBE9"/>

    <rect x="0" y="200" width="100" height="30" fill="#E1DFDD"/>
    <text x="10" y="220" font-weight="600">▼ 非常勤</text>

    <text x="10" y="255">高橋 三郎</text>
    <line x1="0" y1="270" x2="940" y2="270" stroke="#EDEBE9"/>
    <text x="10" y="295">中村 四郎</text>
    <line x1="0" y1="310" x2="940" y2="310" stroke="#EDEBE9"/>

    <rect x="0" y="310" width="100" height="30" fill="#E1DFDD"/>
    <text x="10" y="330" font-weight="600">▼ 車両</text>
    <text x="10" y="365">車両1号</text>
    <line x1="0" y1="380" x2="940" y2="380" stroke="#EDEBE9"/>

    <rect x="105" y="85" width="110" height="30" rx="2" fill="#5C2D91" opacity="0.9"/>
    <text x="115" y="105" fill="white" font-size="12px">運営会議</text>

    <rect x="105" y="125" width="710" height="30" rx="2" fill="#0078D4" opacity="0.9"/>
    <text x="115" y="145" fill="white" font-size="12px">生活介護（Aグループ）</text>

    <rect x="105" y="165" width="230" height="30" rx="2" fill="#0078D4" opacity="0.9"/>
    <text x="115" y="185" fill="white" font-size="12px">生活介護（Bグループ）</text>

    <rect x="225" y="235" width="230" height="30" rx="2" fill="#D83B01" opacity="0.9"/>
    <text x="235" y="255" fill="white" font-size="12px">ショートステイ受入（佐藤様）</text>

    <rect x="105" y="275" width="110" height="30" rx="2" fill="#107C10" opacity="0.9"/>
    <text x="115" y="295" fill="white" font-size="12px">一時ケア(伊藤様)</text>
    <rect x="180" y="280" width="110" height="25" rx="2" fill="#A80000" stroke="red" stroke-width="2"/>
    <text x="190" y="298" fill="white" font-size="12px">競合！(E)</text>

    <rect x="105" y="345" width="80" height="30" rx="2" fill="#B146C2" opacity="0.9"/>
    <text x="115" y="365" fill="white" font-size="12px">送迎(往)</text>
    <rect x="765" y="345" width="80" height="30" rx="2" fill="#B146C2" opacity="0.9"/>
    <text x="775" y="365" fill="white" font-size="12px">送迎(復)</text>

    <rect x="585" y="160" width="230" height="40" fill="#FDE7E9" opacity="0.7"/>
    <text x="680" y="185" fill="#A80000" font-weight="bold">！競合！(F)</text>
    <rect x="585" y="165" width="230" height="30" rx="2" fill="#0078D4" opacity="0.5" stroke-dasharray="5,5" stroke="#323130"/>
  </g>
</svg>
```

<a id="section-schedule-modal"></a>
### 4.4. 予定の追加・編集フォーム（モーダル）

モーダルダイアログ（`Modal`）またはパネル（`Panel`）で実装。

  * **段階的開示:** 「送迎あり」を選択すると車両選択欄が表示されるなど、動的に項目を変化。
  * **能動的なエラー防止:** 担当者選択時、`useSP`経由でその時間帯の空き状況をチェックし、競合がある場合はリアルタイムで警告を表示。

```svg
<svg width="800" height="600" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="font-family: 'Segoe UI', 'Meiryo UI', sans-serif;">
  <rect width="800" height="600" fill="rgba(0, 0, 0, 0.4)"/>

  <g transform="translate(200, 50)">
    <rect width="400" height="500" fill="white" rx="4" style="box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>

    <text x="20" y="35" font-weight="600" font-size="20px">予定の新規作成</text>
    <text x="370" y="35" font-size="20px" cursor="pointer">✕</text>
    <line x1="0" y1="50" x2="400" y2="50" stroke="#EDEBE9"/>

    <g transform="translate(30, 70)">
      <text x="0" y="0" font-size="14px">サービス種別*</text>
      <rect x="0" y="10" width="340" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="10" y="30" fill="#323130">一時ケア</text>
      <text x="320" y="30">▼</text>

      <text x="0" y="60" font-size="14px">日時*</text>
      <rect x="0" y="70" width="150" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="10" y="90" fill="#323130">2025/10/05 📅</text>
      <rect x="160" y="70" width="80" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="170" y="90" fill="#323130">10:00</text>
      <text x="250" y="90">〜</text>
      <rect x="260" y="70" width="80" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="270" y="90" fill="#323130">12:00</text>

      <text x="0" y="120" font-size="14px">利用者*</text>
      <rect x="0" y="130" width="340" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="10" y="150" fill="#323130">🔍 田中 次郎 様</text>

      <text x="0" y="180" font-size="14px">担当者*</text>
      <rect x="0" y="190" width="340" height="32" stroke="#A80000" stroke-width="2" fill="white" rx="2"/>
      <text x="10" y="210" fill="#323130">鈴木 一郎</text>
      <text x="320" y="210">▼</text>

      <rect x="0" y="230" width="340" height="30" fill="#FDE7E9" rx="2"/>
      <text x="10" y="250" fill="#A80000" font-size="12px">⚠️ 鈴木 一郎は同時刻に「生活介護」の予定があります。</text>

      <text x="0" y="285" font-size="14px">送迎</text>
      <rect x="40" y="275" width="40" height="20" rx="10" fill="#0078D4"/>
      <circle cx="70" cy="285" r="8" fill="white"/>
      <text x="90" y="288" font-size="14px">あり</text>

      <text x="0" y="320" font-size="14px">使用車両</text>
      <rect x="0" y="330" width="340" height="32" stroke="#8A8886" fill="white" rx="2"/>
      <text x="10" y="350" fill="#323130">車両1号車 ▼</text>


    </g>

    <line x1="0" y1="440" x2="400" y2="440" stroke="#EDEBE9"/>
    <g transform="translate(30, 450)">
      <rect x="240" y="10" width="100" height="32" rx="2" fill="#0078D4"/>
      <text x="270" y="30" fill="white">保存する</text>
      <rect x="130" y="10" width="100" height="32" rx="2" stroke="#8A8886" fill="white"/>
      <text x="150" y="30" fill="#323130">キャンセル</text>
    </g>
  </g>
</svg>
```

<a id="section-mobile-view"></a>
### 4.5. モバイルビュー（非常勤・現場職員向け） - 操作性重視・MUIアイコン導入版

スマートフォン利用を前提とした、タスク指向のUI。現場職員が「迷わない」「素早く操作できる」ことを目指し、MUIアイコンを活用した直感的なデザインを採用。

  *   **アジェンダビュー:** その日の自分のタスクを時系列リストで表示。
  *   **タップ領域の確保:** ボタンや各項目（TaskCard）を大きくし、押し間違いを防ぐ。
  *   **状態の視覚化:** ステータス（完了、進行中、未着手）を色とMUIアイコンで明確に区別。
  *   **次に行う操作の明示:** 各タスクカードに「記録する」「電話する」「開始打刻」などのアクションボタンをアイコン付きで常設。

```svg
<svg width="320" height="600" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="font-family: 'Segoe UI', 'Meiryo UI', sans-serif; background-color: white; border: 1px solid #ccc;">
<rect width="320" height="60" fill="#0078D4"/>
<text x="160" y="40" text-anchor="middle" fill="white" font-size="20px" font-weight="600">本日のタスク</text>
<rect width="320" height="40" fill="#F3F2F1"/>
<text x="15" y="85" font-size="16px" font-weight="600">2025年10月5日（日）</text>

<g transform="translate(0, 100)">

<rect x="10" y="10" width="300" height="90" rx="4" fill="#F3F2F1" style="box-shadow: 0 1px 2px rgba(0,0,0,0.1);"/>
<rect x="10" y="10" width="6" height="90" fill="#4CAF50" rx="4 0 0 4"/>
<text x="25" y="35" font-size="14px" fill="#605E5C">09:00 - 10:00</text>
<text x="25" y="60" font-size="16px" font-weight="600">一時ケア（伊藤様）</text>
<path d="M260 25 l15 15 l-8 8 l-15 -15 Z M270 20 l5 5 l-18 18 l-5 -5 Z" fill="#4CAF50" />
<text x="280" y="35" font-size="14px" fill="#4CAF50" font-weight="bold">完了</text>

<rect x="10" y="110" width="300" height="150" rx="4" fill="white" stroke="#D83B01" stroke-width="2" style="box-shadow: 0 2px 4px rgba(0,0,0,0.15);"/>
<rect x="10" y="110" width="6" height="150" fill="#D83B01" rx="4 0 0 4"/>
<text x="25" y="135" font-size="14px" fill="#605E5E">10:00 - 12:00</text>
<text x="25" y="160" font-size="18px" font-weight="600">一時ケア（田中 次郎 様）</text>
<path d="M12 2 L1 21 H23 Z M13 18 H11 V16 H13 V18 Z M13 14 H11 V10 H13 V14 Z" transform="translate(20, 175) scale(0.8)" fill="#D83B01"/>
<text x="45" y="190" font-size="14px" fill="#A80000">注意事項：アレルギー情報</text>

<rect x="25" y="210" width="130" height="40" rx="4" fill="#0078D4"/>
<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" transform="translate(40, 222) scale(0.8)" fill="white"/>
<text x="70" y="235" text-anchor="start" fill="white" font-size="14px" font-weight="600">サービス記録</text>

<rect x="165" y="210" width="130" height="40" rx="4" fill="#107C10"/>
<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.02.75-.25 1.02l-2.2 2.2z" transform="translate(180, 222) scale(0.8)" fill="white"/>
<text x="210" y="235" text-anchor="start" fill="white" font-size="14px" font-weight="600">緊急連絡</text>

<rect x="10" y="270" width="300" height="120" rx="4" fill="white" style="box-shadow: 0 1px 2px rgba(0,0,0,0.1);"/>
<rect x="10" y="270" width="6" height="120" fill="#605E5C" rx="4 0 0 4"/>
<text x="25" y="295" font-size="14px" fill="#605E5C">14:00 - 16:00</text>
<text x="25" y="320" font-size="16px" font-weight="600">ショートステイ受入（佐藤様）</text>

<rect x="25" y="340" width="270" height="45" rx="4" fill="#0078D4"/>
<path d="M7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM12 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm-1-11h2v5h-2zm-1.29-5.96L11 2.05V.05h-2v2l-1.29.57z" transform="translate(60, 352) scale(0.8)" fill="white"/>
<text x="160" y="368" text-anchor="middle" fill="white" font-size="16px" font-weight="600">サービス開始</text>
</g>

<rect width="320" height="60" y="540" fill="white" stroke-width="1" stroke="#EDEBE9"/>
<text x="60" y="575" text-anchor="middle" font-size="12px" fill="#0078D4">🏠 ホーム</text>
<rect x="40" y="597" width="40" height="3" fill="#0078D4"/>
<text x="160" y="575" text-anchor="middle" font-size="12px">📝 記録一覧</text>
<text x="260" y="575" text-anchor="middle" font-size="12px">🔔 通知</text>
</svg>
```

---

<a id="section-existing-system"></a>
## 5. 現状のシステム情報と開発ガイドライン (React + SharePoint SPA)

以下の情報は、既存のMVP実装（運営指導・記録管理システム）のアーキテクチャと開発規約である。新規開発はこの構造と整合性を保つ必要がある。

# 運営指導・記録管理システム MVP (React + SharePoint SPA)

> 📌 クイックリンク: `docs/provisioning.md#whatif-ドライラン-と-job-summary` ｜ `provision/schema.xml`

![Quality Gates](https://github.com/yasutakesougo/audit-management-system-mvp/actions/workflows/test.yml/badge.svg)
![Provision WhatIf](https://github.com/yasutakesougo/audit-management-system-mvp/actions/workflows/provision-sharepoint.yml/badge.svg)
![Lint](https://img.shields.io/badge/lint-pass-brightgreen)
![TypeCheck](https://img.shields.io/badge/types-pass-informational)
![Coverage Lines](https://img.shields.io/badge/coverage-70%25%2B-green)

> Quality Gate (Phase 3 Baseline): Lines >= 70% / Functions >= 70% / Statements >= 70% / Branches >= 65%
> Current (local latest): Lines ~78% / Functions ~73% / Statements ~78% / Branches ~76% (headroom maintained before next phase)

本プロジェクトは、React, TypeScript, Vite, MUIを使用し、SharePoint OnlineをバックエンドとするSPAアプリケーションのMVP実装です。

## Tech Stack
- React 18 + TypeScript + Vite
- MSAL (@azure/msal-browser, @azure/msal-react)
- SharePoint Online REST API
- LocalStorage (temporary audit log persistence)

## Key Features
- Azure AD (Entra ID) login and token acquisition
- SharePoint list access via a custom hook (`useSP`)
- Record listing & creation against a SharePoint list
- Local audit trail with CSV export
- Org/Staff schedule briefing output for morning/evening huddles
- Environment validation & helpful error messages for misconfiguration
- Schema-driven provisioning supports Text/Choice/DateTime/Number/Note/User/Lookup (additive choice policy, safe type migration)
- Manual MSAL sign-in/out control surfaced in the app header
- Users master smoke UI for create / rename / delete sanity checks

## Local Schedule Setup

The `/schedule` feature requires either a real SharePoint tenant or demo mode.

- See `docs/dev/schedule-local-notes.md` for:
  - Background on the `contoso.sharepoint.com` errors
  - Option A (live tenant) vs. Option B (demo/no-login) setup flow
  - Known hardening tasks and troubleshooting tips

> ℹ️ Review the notes before running `npm run dev:e2e` locally so Playwright-specific env overrides don’t leak into regular dev sessions.

## Users Master Smoke Test
> 目的: SharePoint `Users_Master` リストとの CRUD 経路（hook → API → Audit ログ書き込み）を手動で検証するミニフローです。

1. `npm run dev` でアプリを起動し、MSAL サインインを完了させます。
2. 上部ナビの「利用者」タブ (`/users`) を開くと、`useUsers` が即時フェッチを行い `status` が `success` になるまで待機します。
3. フォームに `UserID` と `FullName` を入力し **Create** を押すとリストへ登録され、テーブルに即時反映されます。
4. 任意の行で **Rename\*** を押すと `FullName` の末尾に `*` を追加する更新が行われます（更新 API 経路の動作確認）。
5. **Delete** を押し確認ダイアログで `OK` すると SharePoint 側から削除され、テーブルとローカル状態から消えます。
6. ハッピーケース後は監査ログ (`/audit`) で該当アクションが記録されているかを確認し、必要なら CSV をエクスポートします。

補足:
- 上部の `status:` 表示は `useUsers` の内部状態のまま (`loading`/`success`/`error`) です。
- `Refresh` ボタンは競合試験や多端末検証の際に手動で再フェッチできます。
- 失敗時は `ErrorState` コンポーネントが SharePoint エラー本文をメッセージ化して表示します。

## Org/Staff Briefing Snapshot
> 目的: 朝夕ミーティング向けに、SharePoint スケジュールリストの「Org」「Staff」カテゴリを 1 行テキストにまとめる最小実装を確認するフローです。

1. `VITE_FEATURE_SCHEDULES=1` を有効化し、`npm run dev` でアプリを起動します。
2. スケジュール画面から当日の予定を読み込み、Org/Staff の予定が存在することを確認します（SharePoint 側のカテゴリ Choice が `Org` / `Staff` に分類されている前提）。
3. Briefing カードに表示されるテキストが `HH:mm` レンジ・タイトル・ロケーションの形式になっていることを確認します。重なり時間帯のみ取得されるため、日付境界を跨ぐ予定も適切に整形されます。
4. 翌日分の Briefing も自動集計されるため、朝会/夕会資料への転記はコピー＆ペーストでまかなえます。

実装メモ:
- `src/features/schedule/spClient.briefing.ts` で SharePoint REST を叩き、Org/Staff それぞれの行を取得します。
- `src/features/schedule/briefing.ts` が User Care 含む全カテゴリを束ね、朝夕 2 セッションの配列を返します。
- 重複・空行はフィルタ済みで、フォーマットは `08:30-10:00 研修 (会議室A)` のように統一されています。

## Project Structure (excerpt)
```
src/
  auth/              MSAL config & hook
  lib/               Core helpers (SharePoint client, audit log)
  features/
    records/         Record list UI & migration from legacy API
    compliance-checklist/
    audit/           Audit panel with CSV export
  app/               Shell, routing, theming
  ui/components/     Reusable UI pieces
```

## Environment Variables (.env)
### Quick Setup
1. Copy example: `cp .env.example .env`
2. Choose either of the following configuration styles:
  - **Simple**: set both `VITE_SP_RESOURCE` and `VITE_SP_SITE_RELATIVE`
  - **Full URL**: set `VITE_SP_SITE_URL` (auto-derives the values above)
3. Edit the placeholders:
  - `<yourtenant>` → SharePoint tenant host (no protocol changes)
  - `<SiteName>`  → Target site path segment(s)
4. Provision MSAL SPA credentials: `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID`, optionally `VITE_MSAL_REDIRECT_URI` / `VITE_MSAL_AUTHORITY` / `VITE_MSAL_SCOPES`
5. Restart dev server (`npm run dev`).

> Override precedence: values passed directly to `ensureConfig` (e.g. in tests) always win. `VITE_SP_RESOURCE` / `VITE_SP_SITE_RELATIVE` from the env override `VITE_SP_SITE_URL`, and the full URL fallback is only used when both override values are omitted.

#### Testing with overrides
- Call config helpers with an override object instead of mutating `import.meta.env`.
- Example: `resolveSpCacheSettings({ VITE_SP_GET_SWR: '1', VITE_SP_GET_SWR_TTL_MS: '120000' })`.

```
VITE_MSAL_CLIENT_ID=<actual app (client) ID>
VITE_MSAL_TENANT_ID=<your tenant ID>
VITE_SP_RESOURCE=https://<tenant>-my.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<site-name>
VITE_WRITE_ENABLED=1          # only if you really intend to write
VITE_SKIP_LOGIN=0             # or remove the line
```
### Reading environment config

- **App/runtime code:** read configuration via `getAppConfig()` from `src/config/appConfig.ts`.
- **Config layer / adapters only:** low-level reads belong in `src/config/**` and should use the helpers exported from `env.ts`.
- **Never** call `import.meta.env` directly in feature or lib code—the linter and pre-push/CI guard will fail the build.

> **MSAL defaults:** The example `.env` ships wired to the “Audit SPA” registration
> (`clientId=619be9a1-ccc4-46b5-878b-ea921b4ce0ae`, tenant `650ea331-3451-4bd8-8b5d-b88cc49e6144`).
> Override these values if you point the app at a different Azure AD tenant or application.

### Rules / Validation Logic
| Key | Requirement | Auto-Normalization | Error If |
|-----|-------------|--------------------|----------|
| VITE_SP_RESOURCE | `https://*.sharepoint.com` / no trailing slash | Trailing slash trimmed | Not matching regex / placeholder present |
| VITE_SP_SITE_RELATIVE | Starts with `/`, no trailing slash | Adds leading `/`, trims trailing slashes | Placeholder present / empty |
| VITE_SP_SITE_URL *(optional)* | Full site URL | Splits into RESOURCE + SITE_RELATIVE | Missing scheme/host/path |
| VITE_SP_SITE *(optional)* | Full site URL alias | Splits into RESOURCE + SITE_RELATIVE | Missing scheme/host/path |
| VITE_SP_LIST_USERS_MASTER *(optional)* | List title override | Whitespace trimmed | Placeholder present / empty |
| VITE_SP_LIST_COMPLIANCE / VITE_SP_CHECKLIST_LIST *(optional)* | Compliance checklist list title | Defaults to `Compliance_CheckRules` and falls back to `Compliance_Checklist`; override when tenant uses a different name | 404 Not Found when list is missing |
| VITE_SP_LIST_COMPLIANCE_GUID *(optional)* | Compliance checklist list GUID | Bypasses title lookups when provided; braces are stripped automatically | GUID invalid or list missing |
| VITE_MSAL_CLIENT_ID | Azure AD app (SPA) client ID | — | Placeholder / empty |
| VITE_MSAL_TENANT_ID | Azure AD tenant ID (GUID) | — | Placeholder / empty |
| VITE_MSAL_REDIRECT_URI *(optional)* | Redirect URI for SPA | Defaults to `window.location.origin` | Invalid URI |
| VITE_MSAL_AUTHORITY *(optional)* | Authority URL | Defaults to `https://login.microsoftonline.com/<tenant>` | Non-HTTPS / mismatched tenant |
| VITE_MSAL_SCOPES *(optional)* | Token scopes list (space/comma separated) | Defaults to `${VITE_SP_RESOURCE}/.default` | Empty / unsupported scope |
| VITE_GRAPH_SCOPES *(optional)* | Graph delegated scopes | — | useSP must support Graph path |

Placeholders recognized as invalid: `<yourtenant>`, `<SiteName>`, `__FILL_ME__`.

### Debugging Misconfiguration
If misconfigured, `ensureConfig` (in `src/lib/spClient.ts`) throws with a multi-line guidance message and the error boundary (`ConfigErrorBoundary`) renders a remediation panel.

To confirm loaded values during development:
```ts
if (import.meta.env.DEV) {
  console.log('[ENV]', import.meta.env.VITE_SP_RESOURCE, import.meta.env.VITE_SP_SITE_RELATIVE);
}
```

### Common Pitfalls & Fixes
| Symptom | Cause | Fix |
|---------|-------|-----|
| "SharePoint 接続設定が未完了です" | Placeholders still present | Replace `<yourtenant>` / `<SiteName>` with real values |
| 401 after sign-in | Permissions not admin-consented | Grant admin consent to SharePoint delegated permissions |
| 404 `_api/web` | Wrong site relative path | Double-check `/sites/<SiteName>` casing & existence |
| `VITE_SP_RESOURCE の形式が不正` | Added trailing slash or missing host | Remove trailing `/`, ensure `https://tenant.sharepoint.com` |
| `VITE_SP_SITE_URL の形式が不正` | Missing path or non-SharePoint host | Use full URL like `https://tenant.sharepoint.com/sites/Example` |
| `AcquireTokenSilent` scope warnings | Graph scopes configured but useSP still targets REST | Remove `VITE_GRAPH_SCOPES` or update implementation |

### Cache & Concurrency Knobs
- `VITE_SP_GET_SWR` — Enable stale-while-revalidate + ETag reuse (`0` = off, `1` = opt-in).
- `VITE_SP_GET_SWR_TTL_MS` — Hard TTL for cached GET responses (ms). Overrides legacy `VITE_SP_GET_TTL_MS` / `VITE_SP_GET_CACHE_TTL` when present.
- `VITE_SP_GET_SWR_WINDOW_MS` — Additional SWR window (ms) after TTL expires before treating entries as cold misses.
- `VITE_SP_GET_TTL_MS` — Legacy TTL alias (still read for backward compatibility when SWR-specific envs are omitted).
- `VITE_SP_GET_CACHE_MAX_ENTRIES` — Max cached GET entries before LRU eviction (default 200).
- `VITE_SP_MAX_CONCURRENCY` — Max simultaneous SharePoint requests (default 6).
- `VITE_SP_NETWORK_RETRIES` — Network-layer retry attempts for transport failures (default 3).
- `VITE_SP_RETRY_MAX`, `VITE_SP_RETRY_BASE_MS`, `VITE_SP_RETRY_MAX_DELAY_MS` — 429/503/504 backoff tuning knobs shared by GET and $batch flows.

### Stale-While-Revalidate & Scoped Bust (opt-in)
- Flip `VITE_SP_GET_SWR=1` to opt into background refresh with SharePoint ETag reuse. Hard TTL is controlled by `VITE_SP_GET_SWR_TTL_MS`; the additional grace window comes from `VITE_SP_GET_SWR_WINDOW_MS`.
- Fresh hits (<= TTL) return immediately from cache. Between TTL and TTL + SWR window, cached data is returned instantly while a single background refresh revalidates the entry. Beyond that window the entry is treated as cold and a network fetch occurs.
- When SharePoint responds `304 Not Modified`, the client resets the TTL without touching the JSON payload. New `If-None-Match` headers are attached automatically whenever a cached ETag exists.
- `getListItemsByTitle(..., { bypassCache: true })` or a manual `x-sp-bypass-cache: 1` header skips both cache usage and ETag headers for one-off debugging.
- Mutations and `$batch` calls invalidate only the affected cache keys using tags such as `list:Records` / `list:Records:item:42`. If parsing a batch payload fails to detect targets, the client falls back to a global bust.

### Optional Flags
```
# Verbose debug for audit & SharePoint client
VITE_AUDIT_DEBUG=1

# Retry tuning (keep defaults unless diagnosing throttling)
VITE_SP_RETRY_MAX=4
VITE_SP_RETRY_BASE_MS=400
VITE_SP_RETRY_MAX_DELAY_MS=5000
```

### Dev Tips
- React Router v7 future flags are enabled via `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>` to silence the upgrade warnings and keep behavior aligned with the upcoming major release. Leave the flags in place until the project fully migrates to v7, then remove the `future` prop once `react-router-dom@7` is adopted.
- After changing auth settings (MSAL config, scopes, or cookie policy), clear site cookies once to flush stale MSAL state.
- Inspect cache stats in DevTools via `window.__SP_DBG__()` — it now reports `{ size, hits, cacheHits, staleHits, swrRefreshes, _304s, lruKeysSample }`. Individual counters (`window.__SP_GET_HITS__`, `__SP_GET_CACHE_HITS__`, `__SP_GET_STALE_HITS__`, `__SP_GET_SWR_REFRESHES__`, `__SP_GET_304s__`) remain available for quick console pokes.

### Bypass cache (for debugging)
- Add header `x-sp-bypass-cache: 1` on a GET to force a network fetch.
- Or pass `opt: { bypassCache: true }` to `getListItemsByTitle` if you opt into the helper flag (suppresses both cache usage and automatic `If-None-Match`).

> Security: Never put client secrets in `.env` (frontend). Only `VITE_` prefixed public config belongs here.

## Security

#### Cookie policy helper

Use `cookiePolicy({ crossSite })` to derive **SameSite** and **Secure** automatically.

- Cross-site cookies in production → `SameSite=None; Secure` (required by modern browsers).
- Local dev without HTTPS → falls back to `SameSite=Lax` (avoids Secure-on-HTTP breakage).
- After switching dev to HTTPS, **clear cookies** to remove stale warnings.

Utilities:
- `buildSetCookie(name, value, options)` → single `Set-Cookie` string.
- `buildCookieBundle(base, items)` → several cookies at once.
- `appendSetCookies(headers, cookies)` → append multiple cookies (Edge-friendly).

Types:
- Reuse `SameSite` union (`'none' | 'lax' | 'strict'`) across frameworks (Express/Next/Hono).
- Pair this helper with your CSP / CSRF strategy—MDN’s [`Set-Cookie` security guide](https://developer.mozilla.org/docs/Web/HTTP/Cookies#security) has an excellent checklist for hardening those headers.
- Set `COOKIE_DEV_WARN=1` in your dev shell to fire `onDevFallbackWarn` whenever a cross-site cookie request falls back to `SameSite=Lax; Secure=false` locally (helps catch stray prod-only expectations).
- Need to bridge framework APIs? Use dedicated adapters like `src/lib/http/edgeAdapter.ts` / `nodeAdapter.ts` (ESLint is configured to allow them). For rare exceptions, add a one-line disable with a justification: `// eslint-disable-next-line no-restricted-properties -- OAuth redirect cookie from framework hook`.
- Local commits run `npm run lint`, `npm run typecheck`, `npm run lint:cookies`, and `lint-staged` automatically via Husky’s pre-commit hook—only use the documented ESLint disable for adapters when absolutely necessary.

## Audit Metrics (Testing Contract)
`AuditPanel` exposes a stable, test-focused metrics container after executing a batch sync.

Selector:
```
[data-testid="audit-metrics"]
```

Exposed data attributes (stringified numbers):
| Attribute | Meaning |
|-----------|---------|
| `data-new` | Newly inserted items (success - duplicates) |
| `data-duplicates` | Duplicate (409) item count (idempotent successes) |
| `data-failed` | Failed (non-2xx except 409) items remaining after last attempt |
| `data-success` | Successful count including duplicates |
| `data-total` | Total items attempted in last batch |

Each pill also has `data-metric` = `new` / `duplicates` / `failed` in stable order for ordering assertions.

### Example (Playwright)
```ts
const metrics = page.getByTestId('audit-metrics');
await expect(metrics).toHaveAttribute('data-total', '6');
await expect(metrics).toHaveAttribute('data-success', '5');
await expect(metrics).toHaveAttribute('data-duplicates', '2');
await expect(metrics).toHaveAttribute('data-new', '3');
await expect(metrics).toHaveAttribute('data-failed', '1');
const order = await metrics.locator('[data-metric]').evaluateAll(ns => ns.map(n => n.getAttribute('data-metric')));
expect(order).toEqual(['new','duplicates','failed']);
```

Rationale: Avoid brittle regex on localized labels (新規/重複/失敗) and ensure i18n or stylistic changes don't break tests.

> i18n Note: Metric pill labels are centralized in `src/features/audit/labels.ts` for future localization. Only data-* attributes are used by tests, so translating the labels will not break assertions.

### Helper Utility (Optional)
`tests/e2e/utils/metrics.ts` provides `readAuditMetrics(page)` and `expectConsistent(snapshot)`:
```ts
import { readAuditMetrics, expectConsistent } from '../utils/metrics';

test('batch metrics math', async ({ page }) => {
  await page.goto('/audit');
  // ... seed logs & trigger batch ...
  const snap = await readAuditMetrics(page);
  expectConsistent(snap); // validates newItems === success - duplicates
  expect(snap.order).toEqual(['new','duplicates','failed']);
});
```

## Authentication Flow
1. MSAL instance configured in `src/auth/msalConfig.ts`
2. `src/lib/msal.ts` boots a shared `PublicClientApplication` instance and initialization
3. App root is wrapped by `MsalProvider` in `src/main.tsx`, and the header shows a `Sign in` / `Sign out` control (`src/ui/components/SignInButton.tsx`)
4. `useAuth()` hook exposes `acquireToken()` which obtains an access token for SharePoint using configured scopes (defaults to `${VITE_SP_RESOURCE}/.default`).
5. Token stored transiently (sessionStorage) to bridge legacy calls during migration.

> ヒント: 自動ログインが無い環境では、右上の「サインイン」ボタンから `loginPopup` を実行できます。既存セッションがある場合は起動時に `ssoSilent` が働き、自動復元されます。

## SharePoint Access: `useSP`
Located in `src/lib/spClient.ts`.

### Responsibilities
- Validate environment & normalize base SharePoint URL
- Provide `spFetch` (authenticated REST calls with retry on 401)
- Provide convenience helpers:
  - `getListItemsByTitle(title, odataQuery?)`
  - `addListItemByTitle(title, payload)`

### Usage Example
```tsx
import { useSP } from '../lib/spClient';

function Example() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  useEffect(() => {
    getListItemsByTitle('Records').then(items => console.log(items));
  }, []);

  const add = () => addListItemByTitle('Records', { Title: 'New Item' });

  return <button onClick={add}>Add</button>;
}
```

### Error Handling
- Misconfigured env throws early, describing what to fix.
- 401 responses trigger a silent re-acquire of token (once) before failing.
- Errors bubble with contextual JSON snippet (truncated) for easier debugging.

### 運用メモ（Choice フィールドの変更ポリシー）

- `choicesPolicy` は 既定 `additive`：不足選択肢のみ追加し、既存は削除しません。
  - Summary 出力例: `+ Add choices ...`, `! Keep existing (not removing) ...`
- `replace` は将来拡張用で、現バージョンでは警告ログを出し `additive` と同じ動作です。
- 選択肢削除が必要な場合は、ユーザー影響とデータ整合性を精査し、移行計画（新列 *_v2 作成など）を検討してください。

## Migration Notes
Legacy helper `spRequest` and old `records/api.ts` have been removed / deprecated.
Use `useSP()` directly in components or create thin feature-specific wrappers if needed.

## Development
Install dependencies and start dev server (port 3000):
```
npm install
npm run dev
```

### Test & Coverage

### Strategy
- **Unit (厚め)**: 同期ロジック、リトライ、バッチパーサ、CSV 生成などの純粋ロジックは **Vitest** で網羅。UI 断面も **React Testing Library (jsdom)** でコンポーネント単位を検証。
- **E2E (最小)**: **Playwright** は「失敗のみ再送」「429/503 リトライ」など **重要シナリオの最小数** に絞り、ページ全体のフレーク回避と実行時間を抑制。
- **カバレッジ・ゲート**: Phase 3 固定（Lines/Funcs/Stmts **70%** / Branches **65%**）。
  ロジックの追加時はユニットテストを先に整備して緑化→E2E 追加は必要最小に留めます。
- Vitest suites that touch `ensureConfig` reset `import.meta.env` per test to avoid leaking real tenant URLs into assertions; keep this pattern when adding new cases.
- Org/Staff briefing行の変換は `src/features/schedule/__tests__/briefing.org-staff.spec.ts` でカバー。スポットチェックは `npm run test -- briefing.org-staff` で素早く実行できます。

現在の固定品質ゲート (Phase 3 固定化):
```
Lines >= 70%, Statements >= 70%, Functions >= 70%, Branches >= 65%
```
`vitest.config.ts` の `thresholds` を将来引き上げる際は、CI 3 連続グリーン後に 5–10pt 程度ずつ。急激な引き上げは避けてください。

### Coverage Roadmap (Historical / Plan)
現在: Phase 3 (安定運用ベースライン達成)

| Phase | 目標 (Lines/Fn/Stmts \| Branches) | 達成基準 | 主なアクション | 想定タイミング |
|-------|------------------------------------|-----------|----------------|----------------|
| 0 | 20/20/20 \| 10 (導入) | スモーク + 主要ユーティリティ | 初期テスト整備 | 達成済 ✅ |
| 1 | 40/40/40 \| 20 (現状) | 回帰テスト安定 (直近失敗なし) | バッチパーサ / リトライ / UUID フォールバック | 達成済 ✅ |
| 2 | 60/60/60 \| 40 | クリティカルパス (認証, spClient, 監査同期) Happy/エラー系網羅 | useSP リトライ分岐 / 409 重複成功扱い / 部分失敗再送 | 次期 |
| 3 | 70/70/70 \| 65 (固定現状) | UI ロジック分離・Hooks 単体化 | `useAuditSyncBatch` 分岐別テスト | 達成済 ✅ |
| 4 | 80/80/80 \| 65 | 主要分岐ほぼ網羅 (表示のみ除外) | jsdom コンポーネントテスト導入 (ピンポイント) | 中期 |
| 5 | 85+/85+/85+ \| 70+ | コスト/リターン再評価 | Snapshot 最適化 / Flaky 監視 | 後期 |

運用ポリシー (固定化後):
- 閾値は Phase 3 値を維持。新規機能は同等以上のカバレッジを伴って追加。
- Flaky 発生時は引き上げ計画を一旦停止し要因除去 (jitter/タイマー/ランダム化の deterministic 化)。

ローカル詳細メトリクス確認:
```
npm run test:coverage -- --reporter=text
```
CI では text / lcov / json-summary を生成。将来的にバッジ or PR コメント自動化を計画。

### Utility: `safeRandomUUID`
依存注入オプション付き UUID 生成ヘルパ。優先順: (1) 注入実装 (2) `crypto.randomUUID` (3) `crypto.getRandomValues` v4 生成 (4) `Math.random` フォールバック。

```ts
import { safeRandomUUID } from '@/lib/uuid';

// 通常利用
const id = safeRandomUUID();

// テストや特殊用途で固定値を注入
const predictable = safeRandomUUID({ randomUUID: () => 'fixed-uuid-1234' });
```

> 注入によりグローバル `crypto` を差し替えずテストを安定化。

### Quality Gates (Local)
以下をローカルで実行することで、CI と同じ早期フィードバックを得られます:
```
npm run typecheck   # 型不整合の検出
npm run lint        # コードスタイル/潜在バグ検出 (ESLint + @typescript-eslint)
npm run test        # ユニットテスト (最小)
npm run test:coverage  # カバレッジ付き
```
推奨フロー: 変更後すぐ `typecheck` / `lint`、安定したら `test:coverage`。PR 前にすべて PASS を確認してください。

### Mini Runbook (運用即参照)
| 項目 | チェック | メモ |
|------|---------|------|
| Entra App 権限 | Sites.Selected or Sites.ReadWrite.All 同意済 | `API permissions` 画面で Admin consent granted 状態 |
| Redirect URI | `http://localhost:3000` / 本番 URL | SPA (Single-page application) で追加 |
| .env 置換 | `<yourtenant>` / `<SiteName>` が実値化 | `ensureConfig` が placeholder を検出すると起動失敗 |
| SharePoint Lists | `provision-sharepoint.yml` WhatIf → Apply | WhatIf 差分を必ず PR でレビュー |
| Provision schema | `provision/schema.xml` | WhatIf/Apply の両ワークフローが共通参照。古い `schema.json` は使用しません |
| Top Navigation (手動 Apply) | `addTopNavigation` チェックボックス | デフォルト OFF。手動実行で ON にすると Quick/Nav 両方へリンク追加 |
| `changes.json` telemetry | `summary.total` / `summary.byKind[]` | Apply/WhatIf 共通で生成。監査証跡として `reports/` に保存し、内部監査対応時に提出できるようにする |

<a id="section-information-architecture"></a>
## 6. 情報アーキテクチャとナビゲーションマップ

### 6.1 メインナビゲーション（デスクトップ）
- **ホーム / ダッシュボード**: 施設長を中心に、全体の KPI とアラートを即座に確認。
- **スケジュール**: マスタースケジュール（リソースタイムライン）と個人別ビューのタブを切替。既定はロールに応じ自動選択。
- **利用者管理**: 利用者の基本情報、計画、注意事項が閲覧・更新可能。
- **職員管理**: シフト、資格、稼働状況を確認し、シフト草案を連携。
- **レポート**: CSV/PDF エクスポート、月次集計、請求連携用データ出力。
- **監査ログ**: すべてのアクションの追跡、再送、CSV エクスポート。
- **設定**: マスターデータ、機能フラグ、通知設定。

### 6.2 コンテクスチュアルナビゲーション（モバイル）
- 下部タブ: `ホーム` / `記録` / `通知` / `プロフィール`。
- タスクカード内ショートカット: 「サービス記録」→ 記録フォーム、「緊急連絡」→ 担当者電話発信（`tel:`リンク）。
- コンテンツ規模が大きい場合は横スクロールではなくセクション折りたたみを採用。

### 6.3 情報設計
| 階層 | コンテンツ | 表示粒度 | 備考 |
|------|------------|----------|------|
| Level 0 | KPI / アラート / 未処理タスク | 集約値 | ロールベースのサマリカード |
| Level 1 | スケジュール日単位 | 時間帯 + リソース | カレンダー / タイムライン切替 |
| Level 2 | 予定詳細 | タスク詳細、関連記録 | 予定ID/リストID をキーに遷移 |
| Level 3 | 記録・請求データ | 履歴タイムライン | 変更履歴は監査ログへリンク |

<a id="section-user-flows"></a>
## 7. 主要ユースケース別ユーザーフロー

### 7.1 施設長: ダブルブッキング解消フロー
1. ダッシュボードで「競合あり」アラートをクリック。
2. スケジュール画面が競合行にスクロールし、打ち消し線と赤背景で強調。
3. ドラッグ＆ドロップで代替職員に割り当て。競合が解消されるとチェックマークに変化。
4. 変更内容は `useSP().updateListItem` で SharePoint に反映し、監査ログへ `SCHEDULE_UPDATE` として記録。

### 7.2 常勤職員: 日次タスク遂行
1. モバイルでログイン → 今日のタスク一覧を確認。
2. タスクカードの「サービス記録」をタップ → 必須項目にハイライト。
3. 記録送信でトースト表示（成功: 緑 / 失敗: 赤）。
4. 通信エラー時は一時保存し、バナーで再送促進。

### 7.3 非常勤職員: 送迎含む予定参加
1. 通知センターから送迎予定をタップし詳細へ。
2. 「開始打刻」ボタンでチェックイン、`navigator.geolocation` 許諾時は位置情報を添付。
3. 終了後に「送迎完了」を押し、車両チェックリストに署名。

<a id="section-interaction"></a>
## 8. インタラクション設計と状態管理ポリシー

- **状態の分類**
  - `local state`: フォーム入力、モーダル開閉（React state + `useReducer`）。
  - `server cache`: SharePoint データは `@tanstack/react-query` + `useSP` でキャッシュ。
  - `global context`: ロール、Feature Flags、MSAL 認証ステータス（`LayoutContext` + `MsalProvider`）。
- **フィードバック原則**
  - 300ms 以内の処理はインラインスピナー、長時間処理はプログレスバー＋キャンセル。
  - エラーは `callout` もしくは `Snackbar` 表示。再試行可能なリンクを添付。
- **ドラッグ＆ドロップ**
  - `@fullcalendar/resource-timeline` の DnD API や `@dnd-kit/core` を使用。
  - 移動中は潜在競合をヒートマップ表示（赤→オレンジ→緑）。
- **オフライン/回線不安定**
  - `navigator.onLine` 監視でバナー表示。主要 API 呼び出しは指数バックオフ。
  - 作成済みタスクは IndexedDB（`idb-keyval`）で最大50件までローカル保存。

<a id="section-spfx-architecture"></a>
## 9. SPFx/SharePoint連携アーキテクチャ

### 9.1 全体構造
```mermaid
flowchart LR
    A[React SPA (Vite)] -- MSAL acquireToken --> B[Azure AD]
    A -- REST + Retry --> C[SharePoint Online]
    C -- Lists: SupportRecord_Daily / Schedules --> D[(SharePoint Lists)]
    A -- Telemetry --> E[App Insights]
    A -- Feature Flags --> F[Public JSON Config]
```

- SPA は独立デプロイ（Azure Static Web Apps 等）または SPFx WebPart としてホスト。
- SPFx 埋め込み時は `withSpfxContext` HOC で `SPFxContext` を注入し、`useSP` が `SPHttpClient` にフォールバック。
- 認証: MSAL でトークン取得 → SharePoint REST `_api` 呼び出し。Sites.Selected を推奨。

### 9.2 耐障害設計
- SharePoint 停止時は `maintenance` バナーと読み取り専用モードに自動切替。
- `VITE_SP_RETRY_MAX` と `VITE_SP_RETRY_BASE_MS` により指数バックオフ調整。
- `$batch` API 利用時は 80件/changeset を上限に設定し、409 重複は成功扱い。

<a id="section-data-model"></a>
## 10. データモデルとAPIコントラクト

### 10.1 SharePoint リスト主要スキーマ
| リスト名 | 用途 | 主要列 | 備考 |
|----------|------|--------|------|
| `Schedules_Master` | 予定管理 | `Title`, `ServiceType` (Choice), `Start`, `End`, `AssignedStaff` (Lookup), `Vehicle` (Lookup), `Status` (Choice), `Notes` (Note), `EntryHash` (Text, Unique) | `EntryHash` で冪等性担保 |
| `SupportRecord_Daily` | 支援記録 | `Title`, `Participant` (Lookup), `ServiceDate`, `Summary` (Note), `SubmittedBy`, `Attachments` | 送信時点の予定IDを保持 |
| `Vehicles_Master` | 車両管理 | `Title`, `Type`, `Capacity`, `IsAccessible` | 送迎選択肢に利用 |

### 10.2 API コントラクト（例）
```ts
type ScheduleItem = {
  id: string;
  title: string;
  serviceType: 'DayCare' | 'ShortStay' | 'Respite' | 'Transport';
  start: string; // ISO 8601 (tz aware)
  end: string;
  resourceId: string; // staffId or vehicleId
  location?: string;
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
  entryHash: string;
};

type ScheduleConflict = {
  scheduleId: string;
  conflictingResourceId: string;
  reason: 'Overlap' | 'CapacityExceeded' | 'QualificationMissing';
};
```

### 10.3 バリデーション
- 時間帯重複はバックエンドでも `ensureNoOverlap(resourceId, start, end)` を実行。
- `QualificationMissing` 判定のため `Staff_Master` に `Certifications` Choice 列を保持し、`ServiceType` に要求される資格テーブルを `lib/rules/qualification.ts` に定義。

<a id="section-a11y-i18n"></a>
## 11. アクセシビリティと国際化ガイドライン

- **キーボード**: 全ての操作は Tab / Shift+Tab / Enter / Space で完結。DnD は `aria-grabbed` と矢印キー操作の代替を提供。
- **コントラスト**: WCAG AA (明度比 4.5:1) を満たすカラーパレット（Fluent Default + MUI Extended）。
- **フォントサイズ**: デスクトップ 14–18px、モバイル 16px 以上。等価 `rem` 定義を `theme.tsx` に集約。
- **言語切替**: ja-JP を既定、将来の多言語化に備え `@formatjs/intl` ベースの message catalog を `src/i18n/` に保持。
- **スクリーンリーダー配慮**: 予定バーには `aria-label="10:00-12:00 生活介護 担当: 鈴木"` を付与。競合発生時は `aria-live="assertive"` で通知。

<a id="section-performance"></a>
## 12. 性能・運用監視と品質指標

- **パフォーマンス指標**: LCP < 2.5s、INP < 200ms、CLS < 0.1 を目標。メインビューはコード分割し、遅延ロード。
- **ローデータ追跡**: `web-vitals` ライブラリを使い、Application Insights に送信。UX 改善 KPI として週次でモニタ。
- **バックエンド監視**: SharePoint API エラー率 > 2% / 5分で PagerDuty 通知。
- **テレメトリイベント例**: `schedule conflict resolved`, `record submitted`, `offline cache used`。
- **QA Gate**: `npm run health` で lint・typecheck・unit を統合。Playwright スモークは CI 夜間実行。

<a id="section-roadmap"></a>
## 13. リリース計画と段階的導入ロードマップ

| フェーズ | 機能 | 対象ユーザー | 成功指標 |
|----------|------|--------------|----------|
| Phase 0 (Pilot) | モバイルアジェンダ、監査ログ改善 | 非常勤 5名 | 週間アクティブ率 80% |
| Phase 1 | マスタースケジュール、競合アラート | 常勤 10名 | ダブルブッキング件数 -60% |
| Phase 2 | ダッシュボード、レポート | 施設長 / 管理職 | KPI 可視化で週次会議時間 -20% |
| Phase 3 | 送迎チェックイン + 車両連携 | 送迎担当全員 | 遅刻報告件数 -30% |

- フィードバックループ: 各フェーズ後に 1 週間の現場ヒアリングを実施し、Backlog へ反映。
- 機能フラグ (`featureFlags.ts`) で段階的ロールアウトを制御。

<a id="section-process"></a>
## 14. 開発プロセスとワークフロー

- **ブランチ戦略**: `main`（安定）と `develop`（統合）。機能ごとに `feature/*` を派生し、PR でコードレビュー。
- **デザインレビュー**: Figma コンポーネントライブラリと本ドキュメントを照合。主要画面は UX リードが週次レビュー。
- **テスト戦略**
  - Unit: Vitest (`tests/unit/**`)
  - Integration: React Testing Library (`tests/unit/ui/**`)
  - E2E: Playwright (`tests/e2e/**`)、SharePoint モックは MSW + Playwright Fixtures
- **CI/CD**: GitHub Actions (`test.yml`, `provision-sharepoint.yml`) に加え、`release.sh` でタグ付けと changelog 更新。
- **コード規約**: ESLint + Prettier + Stylelint。コミット前に `lint-staged` 実行。

<a id="section-appendix"></a>
## 15. 付録（チェックリストと参考資料）

### 15.1 UAT チェックリスト（一部抜粋）
- [ ] ダッシュボード KPI が正しいロールでフィルタされる
- [ ] 競合のある予定を解消するとアラートが消える
- [ ] モバイル通知から直接タスクに遷移できる
- [ ] オフライン状態で記録送信すると再送キューに積まれる
- [ ] 監査ログ CSV 出力に最新アクションが含まれる

### 15.2 デザインシステム参照
- Fluent UI Web Controls: https://developer.microsoft.com/en-us/fluentui
- Material UI: https://mui.com/
- FullCalendar Resource Timeline: https://fullcalendar.io/docs/resource-timeline

### 15.3 用語集
| 用語 | 説明 |
|------|------|
| オペレーションハブ | 障がい福祉事業所の運営業務を統合するシステムの呼称 |
| 競合アラート | リソース（職員/車両）の二重予約や資格不一致を検知する仕組み |
| Briefing | 朝夕のスタッフ向け予定まとめ機能 |
| EntryHash | SharePoint で重複登録を防ぐためのハッシュ列 |

---

本仕様は、既存の React + SharePoint SPA 実装を土台に、施設規模の拡張や現場オペレーションの負荷軽減を両立させるための指針である。新規機能追加時は、本ドキュメントの原則・アーキテクチャ・品質ゲートを参照し、持続可能な運用とユーザー体験の最適化を継続すること。