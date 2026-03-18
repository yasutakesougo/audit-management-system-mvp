# 🚀 Feature: Today Action Engine Telemetry & HUD Integration (Phase 4-A / 4-B)

**Today Action Engine を、単なる判断エンジンから「観測可能な運用OSコンポーネント」へ昇格させました。**

## 💡 概要

Today の業務実行レイヤー（Action Queue）に対し、既存の純粋な優先度判断アルゴリズム（Engine）を全く汚染することなく、リアルタイムな業務負荷やタスク構成を観測できる Telemetry の流路を実装しました。これにより「意志決定系」と「観測系」が見事に並走・分離するアーキテクチャが完成しています。

## ✨ 実装のハイライト

1. **Telemetry Store の新設**
   - 揮発性の Ring Buffer（Zustand ベース）を用いてキューの状態を一定数キャッシュする `TodayQueueTelemetryStore` を実装。
   - `queueSize`, `p0Count`, `overdueCount` などの「業務の健康状態」を示す重要件数を `summarizeTodayQueue` 関数で集計します。
2. **Hook への観測点と重複送信ガード（Smart Push）の追加**
   - `useTodayActionQueue` でキューが算定された直後の最も信頼できるタイミングを観測点に設定。
   - **重複送信ガード機能**: 
     「UIの文言変化など意図しない再レンダリング」で Telemetry がスパムされないよう、各アイテムの `id + priority + isOverdue` 特徴量でシグネチャを生成。並び順と重要なタスク状態変化があった場合のみバッファへ記録します。
3. **Queue Diagnostics HUD パネル**
   - `HydrationHud` の診断セクション内に `<TodayQueueHudPanel />` を新規追加しました（dev-only でのみ表示）。
   - 「Store の Latest Sample をただ表示するだけ」の **極薄プレゼンテーション** に徹底し、HUD内での再集計は行いません。
   - これにより、Fetch Health / Circuit Breaker / Prefetch と合わせた包括的な監視をシームレスに行える環境が整いました。

## 🔧 Architecture / OS Principles

- **Engine の純粋防衛:** ロギング・バッファリングの責務を Hook に移譲したため、Engine 側での副作用はゼロです。
- **分離された情報公開:** HUD の表示は Diagnostics 環境に制約し、一般ユーザの画面（Production UI）には決して影響が出ない堅牢な仕様としています。

## 🎯 Next Steps (Options)

この基盤をベースに、今後は以下の展開が考えられます。
* **Phase 4-C: Priority Rule Table**
  現在のハードコードされた優先順位（Vital=P0, Incident=P1 等）を分離可能な外部ルールテーブル化し、施設/運用別のカスタマイズに備える。
* **Ops Dashboard Integration**
  今回整備された HUD 向けの Telemetry バッファを、本格的な本番運用向け運用OSダッシュボード（またはビッグデータ基盤）の入力源となるよう拡張する。
