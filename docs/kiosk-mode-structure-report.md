# キオスクモード構造・構成レポート

作成日: 2026-05-01  
対象: `audit-management-system-mvp` の現行実装（`src`）

## 1. 目的
本レポートは、キオスクモードの構成を「有効化経路」「UIレイヤー」「ページ挙動」「テレメトリ」「テスト担保」に分解して可視化する。

## 2. 全体アーキテクチャ

```text
[URL/Route]
  ├─ /kiosk
  └─ /today?kiosk=1|0
        ↓
useKioskDetection (判定SSOT)
        ↓
useAppShellState (layoutMode反映 / fullscreen化)
        ↓
AppShell (data-kiosk属性, ナビ抑制, Exit FAB, Backバー)
        ↓
TodayOpsPage_v3 + TodayBentoLayout
  ├─ kiosk専用Hero/Status/QuickLinks
  └─ kiosk自動リフレッシュ
        ↓
Firestore telemetry (kiosk_ux_event)
```

## 3. 有効化・無効化の構造

### 3.1 判定SSOT
- 実装: `src/features/settings/hooks/useKioskDetection.ts`
- 判定優先順位:
1. パスが `/kiosk` で始まる場合は常時 `true`
2. クエリ `?kiosk=1|true` は `true`、`?kiosk=0|false` は `false`
3. それ以外は `settings.layoutMode === 'kiosk'`

### 3.2 永続設定
- 実装: `src/features/settings/settingsModel.ts`
- `UserSettings.layoutMode` は `'normal' | 'focus' | 'kiosk'`
- 保存先: `localStorage` キー `audit:settings:v1`
- `loadSettingsFromStorage` で復元、`saveSettingsToStorage` で永続化

### 3.3 /today クエリによるトグル
- 実装: `src/app/useAppShellState.ts`
- `/today` 上で `kiosk` クエリを監視し、`updateSettings` で `layoutMode` を更新
- `?kiosk=1|true`: kioskへ切替
- `?kiosk=0|false`: normalへ切替

## 4. AppShell層の構成

### 4.1 レイアウト制御
- 実装: `src/app/AppShell.tsx`, `src/app/useAppShellState.ts`
- `isFullscreenMode = isFocusMode || isKioskMode`
- kiosk時は以下が適用される:
- `data-kiosk="true"` をルートへ付与
- デスクトップサイドバー非表示
- 画面パディング最小化
- `KioskExitFab` 表示
- `KioskBackToToday` 表示（Today以外）

### 4.2 キオスク退出導線
- 実装: `src/app/components/KioskExitFab.tsx`
- 右下FABを1.5秒長押しでアクションシート表示
- アクション:
- 通常モードに戻る (`onExit` -> `layoutMode: normal`)
- 再読み込み
- キャンセル

### 4.3 Today復帰導線
- 実装: `src/app/components/KioskBackToToday.tsx`
- 表示条件:
- kiosk有効
- 現在パスが `/today`・`/kiosk` でない
- クリックで `/today` へ遷移

## 5. スタイル層の構成
- 実装: `src/styles/kiosk.css`
- トリガー: `[data-kiosk='true']`
- 主な設計トークン:
- タッチ最小サイズ `48px`、快適サイズ `56px`
- 文字サイズ拡大（`--kiosk-font-label`, `--kiosk-font-hero`）
- `touch-action: manipulation` で誤操作抑制
- 対象要素:
- Button / IconButton / FAB / ListItem / Card / Typography / Dialog
- キーボード表示考慮:
- `--keyboard-inset` に連動してExit FAB位置とDialog高さを補正

## 6. Today画面でのキオスク専用構成

### 6.1 ページ実装
- 実装: `src/pages/today-isolated/TodayOpsPage_v3.tsx`
- kiosk時:
- `TodayLitePage` には切替えず、`TodayBentoLayout` を使用
- `useKioskAutoRefresh` 有効化（45秒ポーリング + 可視復帰即時refresh）
- セッション開始時に `ux_kiosk_session_started` を送信

### 6.2 レイアウト分岐
- 実装: `src/features/today/layouts/TodayBentoLayout.tsx`
- `settings.layoutMode === 'kiosk'` で分岐
- kiosk時のみ:
- `KioskStatusBar` 表示
- Hero領域を `KioskHeroBlock` に差し替え
- `KioskQuickLinks` を表示
- 通常時のみ表示するカード群の一部を抑制

### 6.3 1タップ導線（QuickLinks）
- 実装: `src/features/today/components/KioskQuickLinks.tsx`
- リンク定義: `src/features/today/model/getKioskQuickLinks.ts`
- 既定リンク:
- `/schedules/week`
- `/handoff-timeline`
- `/meeting-minutes`
- `/room-management`
- `/dashboard/briefing`
- `feature flag` と `role` で表示制御

## 7. テレメトリ構成

### 7.1 型・イベント定義
- 実装: `src/features/today/telemetry/kioskNavigationTelemetry.types.ts`
- 種別: `type: 'kiosk_ux_event'`
- 主要イベント:
- `ux_navigate_from_today`
- `ux_return_to_today`
- `ux_open_fab_menu`
- `ux_kiosk_mode_enabled`
- `ux_kiosk_session_started`
- `ux_visible_refresh_completed`
- `ux_quick_record_*`

### 7.2 送信実装
- 実装: `src/features/today/telemetry/recordKioskTelemetry.ts`
- Firestore `telemetry` コレクションへ `addDoc`
- 非同期送信、失敗時は `console.warn` のみ（UIは止めない）

### 7.3 現在の実装状況
- 実際に発火しているイベント（`src` 内検索ベース）:
- `ux_kiosk_session_started`（Today初回）
- `ux_navigate_from_today`（QuickLinksクリック）
- 定義はあるが現時点で実装呼び出し未確認:
- `ux_return_to_today`
- `ux_open_fab_menu`
- `ux_kiosk_mode_enabled`
- `ux_visible_refresh_completed`
- `ux_quick_record_*`

## 8. テスト担保（主要）
- `src/app/AppShell.kiosk-route.spec.tsx`
- `/today?kiosk=1` で有効化
- `/today?kiosk=0` で無効化
- `/kiosk` で有効化
- `src/app/components/KioskBackToToday.spec.tsx`
- URLクエリ由来kioskでも表示
- `/today` では非表示
- `src/features/today/components/KioskQuickLinks.spec.tsx`
- flagによるリンク表示制御
- telemetry payload（`target=link.id`）検証
- `src/features/today/hooks/__tests__/useKioskAutoRefresh.spec.ts`
- 可視時ポーリング/非可視停止/復帰時即時refreshを検証

## 9. 依存関係サマリ
- ルーティング: `react-router-dom`
- UI: `@mui/material`
- 状態管理: SettingsContext + localStorage
- データ更新: React Query (`invalidateQueries`) + 各featureの `refresh/refetch`
- 計測: Firebase Firestore (`telemetry`)

## 10. 構成上の観察ポイント
- キオスク判定は `useKioskDetection` に一本化され、URL即時反映を優先する設計になっている。
- AppShell層とToday層の二段でkiosk最適化されており、シェル（ナビ/導線）と業務画面（Hero/Status/QuickLinks）の責務分離は明確。
- テレメトリはイベント定義が先行しており、一部イベントは定義済みだが未配線状態。
