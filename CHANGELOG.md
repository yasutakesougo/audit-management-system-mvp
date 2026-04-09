<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **シグナルガバナンスとライフサイクル管理 (ADR-016〜019)**
  - シグナルライフサイクル管理の実装: `open` → `acknowledged` (対応中) → `resolved` (手動解消)
  - `acknowledgedMap` および `resolvedMap` による「対応中/解消」状態の永続化 (localStorage v2)
  - システム全体でのロールベースのシグナルフィルタリング (Admin/Staff)
  - 傍観者効果の解消に向けた客観的なシグナル所有権（Acknowledgement）の導入
  - `setup-incomplete` カテゴリの追加: 行動分析対象未設定など、準備不足を能動的に検知して通知
  - 送迎設定漏れの検出ロジックの実装
- **行動分析ダッシュボードのガバナンス強化 (ADR-020)**
  - 強度行動障害の利用者が分析対象外の場合にアラートを表示
  - 分析対象者が0名の場合に専用の空状態 UI と設定へのナビゲーションを表示
  - 管理者向けの一括「分析対象」フラグ設定機能（開発・検証用）
- **氷山分析ページ再設計 (Phase 1〜3)**
  - 3タブ構成へ再設計: 傾向 / 氷山構造 / 改善サイクル
  - URL同期 (`?tab=trend|iceberg|pdca`) による共有・再訪対応
  - SVG氷山ビジュアライゼーション: 3層構造（行動・場面・背景）のクリック選択・詳細展開
  - 層別サマリカード（アイテム数・重み分布・最新更新日）
  - Kanban形式のPDCAボード: Plan / Do / Check / Act 4列表示
  - **インラインフェーズ遷移**: カードから直接 Plan→Do→Check→Act へワンクリック進行
  - フェーズ遷移成功時のスナックバー通知
  - **停滞フィルタ**: 7日以上未更新のアイテムだけに絞り込むトグルチップ
  - 停滞件数バッジ表示・空列での「停滞なし」メッセージ分岐
  - **軽量監査トレース**: フェーズ変更時に `from→to / 時刻 / 変更者` をカード上に表示
  - MSAL アカウント名による変更者自動取得（SharePointスキーマ変更なし・フロントメモリ上のみ）
  - インライン遷移・フォーム編集の両方でトレース記録
  - Tooltipで詳細表示（変更者 + 日時）
  - KPI再配置: 完了率・リードタイムを改善サイクルタブへ移動
- **ABC記録 × 支援手順 連動 (MVP-1〜6)**
  - Step 2 / Step 3 から ABC 記録ページへの双方向ナビゲーション
  - `sourceContext` (source, slotId, date) を ABC 記録に保存
  - `buildAbcCountBySlot` 純粋関数によるスロット別 ABC 件数集計
  - Step 2 のスロット行に `ABC N` 件数バッジ表示
  - Step 3 → ABC 遷移時に behavior フィールドに下書き自動入力（draft assist）
  - ドラフトバナーで「下書きです」と明示、一度だけ適用の安全設計
  - ABCバッジクリック → `AbcSlotDialog` でスロット別ABC記録一覧をダイアログ表示
  - `filterAbcBySlot` 関数でスロット単位の記録抽出
  - ダイアログ内カードクリックでABC詳細ページへ遷移
- **ナビゲーション統一: キャンセル→ /today**
  - `AttendanceRecordPage`, `TableDailyRecord`, `TimeBasedSupportRecordPage` のキャンセルボタンを `/today` へ統一
  - `useCancelToToday` フック追加（旧名 deprecated alias 残存）

### Changed
- **ナビゲーション再編: 機能別から業務目的別へ移行**
  - サイドバーが目的別（`daily`, `assessment`, `record`, `ops`, `admin`）へ整理されました。
  - TypeScriptの型で `group` 指定を必須化し、設定漏れを防ぐガードレールを導入しました。
  - ナビゲーション設定の整合性を保証する単体テストを追加しました。

## [2026-02-04] Phase 3.7-A Complete

### Added
- **Auth Diagnostics Infrastructure**
  - AuthDiagnosticsCollector (Singleton, 100-event ring buffer)
  - useSchedules integration (Auth Guard events)
  - MsalProvider integration (login events)
  - DevTools API for dev-mode inspection
  - Runbook links for troubleshooting
  - E2E smoke test coverage (3 test cases)

### Quality
- TypeScript: 100% compliance
- ESLint: 0 warnings
- E2E: All tests passing
- Manual: DevTools API verified

### Added

- _TBD_

### Changed

- SP client: wired retry telemetry into debug logger and tightened abort semantics to skip redundant retries.
- feat(spClient): retry hooks + batch/paging.

### Fixed

- _TBD_

## [0.9.1] - 2025-10-11

### Added

- Scaffolded release flow: npm alias for reusable release helper.

### Changed

- Prepared changelog section for the next patch release using Keep a Changelog format.

### Fixed

- (none)

## [0.9.0] - 2025-10-11

### Added

- Configurable week start via `VITE_SCHEDULES_WEEK_START` (default = 1 = Monday).
- Timezone fallback chain `VITE_SCHEDULES_TZ` → `Intl.DateTimeFormat()` → `Asia/Tokyo` implemented in `resolveSchedulesTz()` with validation and console warnings.
- Comprehensive schedule unit coverage now enforced in CI preflight (`npx vitest run tests/unit/schedule --reporter=basic`).
- Documentation update: clarified “YYYY-MM-DD → wall-clock → UTC” normalization strategy and the “no `setHours()`” rule.
- Boundary/DST regression tests: new `dateutils.boundary.extra.spec.ts` covers month/year edges in JST, env-driven week starts, and the LA DST crossover.

### Changed

- Rebuilt date/time helpers around string-based, TZ-safe workflow using `fromZonedTime`; all callers now inherit the runtime timezone/weekday defaults from `getAppConfig()`.
- Hardened `getAppConfig()` parsing and clamping logic for numeric env values.
- Expanded module exports so external consumers can access `startOfDayUtc`, `endOfDayUtc`, `startOfWeekUtc`, `endOfWeekUtc` with explicit TZ and weekday parameters.

### Fixed

- Local/UTC boundary mismatches in `startOfDayUtc`, `endOfDayUtc`, and week helpers (tests now green across JST and DST regions).

### Notes

- Safe for minor version bump → 0.8.x → 0.9.0 (backward-compatible public API, new config options).
- No migration required: existing callers pick up defaults automatically.

<!-- markdownlint-enable MD024 -->
