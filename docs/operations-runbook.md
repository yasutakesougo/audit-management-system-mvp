# 月次記録集計システム 運用手順書

## 📋 システム概要

**システム名**: 月次記録集計システム (Monthly Records Aggregation System)
**目的**: 監査記録の月次自動集計・KPI生成・Teams通知
**技術構成**: Power Automate + SharePoint + Azure Functions + Teams
**展開方式**: 段階的展開（Phase 0 → Phase 1 → Phase 2 → Phase 3 → Production）

---

## 🚀 運用開始手順

### Phase 1: システム準備・確認 (所要時間: 30分)

1. **前提条件確認**
   ```powershell
   # 監視ダッシュボード状態確認
   pwsh -c "./scripts/monitoring-dashboard.ps1 -OutputFormat HTML"

   # Phase 3実行結果確認
   Get-Content "./phase3-execution-results.json" | ConvertFrom-Json
   ```

2. **本番環境接続確認**
   ```powershell
   # SharePoint Production接続
   Connect-PnPOnline -Url "https://yourorg.sharepoint.com/sites/audit" -Interactive

   # 本番接続テスト実行
   pwsh -c "./scripts/production-connection-test.ps1"
   ```

3. **必要なSharePointリスト確認**
   - ✅ `MonthlyRecord_Summary`: 月次集計結果格納
   - ✅ `SupportRecord_Daily`: 日次記録データ
   - ✅ `AppSettings`: システム設定管理
   - ✅ `Users_Master`: ユーザーマスタ管理

### Phase 2: Power Automate設定 (所要時間: 45分)

4. **AppSettings本番適用**
   ```powershell
   # Production設定適用
   $prodSettings = Get-Content "./production-appsettings.json" | ConvertFrom-Json
   # 手動でSharePoint AppSettingsリストに反映
   ```

5. **Power Automateフロー設定**
   - 🔁 **月次集計フロー**: `MonthlyAggregation_MainFlow`
   - 📊 **KPI計算フロー**: `KPI_CalculationFlow`
   - 📢 **Teams通知フロー**: `TeamsNotification_Flow`
   - 🚨 **エラーハンドリング**: `ErrorHandling_Flow`

6. **スケジュール設定**
   - **実行頻度**: 月1回（月初3日以降）
   - **実行時間**: 午前6:00（業務時間前）
   - **タイムアウト**: 10分
   - **リトライ**: 3回（30分間隔）

### Phase 3: 監視・アラート設定 (所要時間: 20分)

7. **KPI監視設定**
   ```powershell
   # 監視ダッシュボード本番デプロイ
   pwsh -c "./scripts/monitoring-dashboard.ps1 -OutputFormat JSON"
   ```

8. **アラート条件設定**
   - 🚨 **処理時間超過**: >10分
   - 🚨 **成功率低下**: <97%
   - 🚨 **SharePoint応答遅延**: >2秒
   - 🚨 **システムエラー**: 任意のエラー発生

---

## 🔧 日常運用手順

### 月次実行確認 (月初3日)

1. **実行前確認**
   ```powershell
   # システム状態確認
   pwsh -c "./scripts/monitoring-dashboard.ps1 -OutputFormat HTML"

   # 緊急停止状態確認
   # AppSettings > MonthlyAggregation_EmergencyStop = false
   ```

2. **実行結果確認**
   - Power Automate実行履歴確認
   - Teams通知受信確認
   - SharePoint MonthlyRecord_Summary更新確認

3. **KPI確認項目**
   - ✅ 処理時間: ≤10分
   - ✅ 成功率: ≥97%
   - ✅ 対象ユーザー数: 設定値通り
   - ✅ エラー件数: 0件

### 週次監視確認 (毎週月曜)

4. **システムヘルスチェック**
   ```powershell
   # ヘルスチェック実行
   pwsh -c "./scripts/monitoring-dashboard.ps1 -OutputFormat JSON"

   # SharePoint接続確認
   Get-PnPContext
   ```

5. **監視項目**
   - SharePoint接続状態
   - Power Automateフロー状態
   - Teams通知設定状態
   - AppSettings整合性

---

## 🚨 トラブルシューティング

### エラーパターン別対応

#### 1. SharePoint接続エラー
**症状**: "SharePoint接続エラー" アラート
```powershell
# 対応手順
Connect-PnPOnline -Url "https://yourorg.sharepoint.com/sites/audit" -Interactive
pwsh -c "./scripts/production-connection-test.ps1"
```

#### 2. 処理時間超過
**症状**: 10分以上の処理時間
```powershell
# 負荷状況確認
Get-Content "./monitoring-dashboard.json" | ConvertFrom-Json

# ユーザー数確認・調整
# AppSettings > MonthlyAggregation_MaxUsers の値を確認
```

#### 3. 成功率低下
**症状**: 成功率 <97%
```powershell
# 詳細ログ確認
Get-Content "./phase3-execution-results.json" | ConvertFrom-Json

# エラーユーザー特定
$results = Get-Content "./phase3-execution-results.json" | ConvertFrom-Json
$failedUsers = $results.ProcessingResults | Where-Object { -not $_.Success }
```

#### 4. Teams通知エラー
**症状**: Teams通知が届かない
- Webhook URL確認
- チャンネル権限確認
- 通知設定再確認

### 緊急停止手順

#### システム緊急停止
```powershell
# 緊急停止スクリプト実行
pwsh -c "./scripts/emergency-stop.ps1"

# または手動でAppSettings更新
# MonthlyAggregation_EmergencyStop = true
```

#### 緊急停止解除
```powershell
# 原因究明・修正後に実行
pwsh -c "./scripts/emergency-stop.ps1 -Resume"

# AppSettings手動更新
# MonthlyAggregation_EmergencyStop = false
```

---

## 📊 パフォーマンス最適化

### システム負荷軽減

1. **バッチサイズ調整**
   - 現在: 5ユーザー/バッチ
   - 推奨: 負荷に応じて3-7ユーザー/バッチ

2. **実行タイミング調整**
   - 業務時間外実行推奨
   - SharePoint負荷の少ない時間帯選択

3. **並列処理最適化**
   - SharePoint API制限考慮
   - バッチ間待機時間調整

### スケールアップ対応

4. **ユーザー数拡張時**
   ```powershell
   # AppSettings更新
   # MonthlyAggregation_MaxUsers: 45 → 100
   # MonthlyAggregation_TimeoutMinutes: 10 → 15
   ```

5. **処理能力向上**
   - Azure Functions Premium Plan検討
   - SharePoint Premium機能活用
   - 並列処理数増加

---

## 🔄 定期メンテナンス

### 月次メンテナンス

1. **ログローテーション**
   ```powershell
   # 古いログファイル削除
   Get-ChildItem -Path "./*-results.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
   ```

2. **パフォーマンス分析**
   - 処理時間トレンド確認
   - 成功率推移確認
   - エラーパターン分析

### 四半期メンテナンス

3. **システム最適化**
   - SharePointリストインデックス確認
   - Power Automateフロー最適化
   - 不要データ清理

4. **セキュリティ確認**
   - アクセス権限監査
   - APIキー更新
   - Webhook設定確認

---

## 📞 サポート・エスカレーション

### 連絡先

- **システム管理者**: [管理者メール]
- **Power Automate担当**: [担当者メール]
- **SharePoint管理者**: [管理者メール]
- **緊急連絡先**: [緊急時電話番号]

### エスカレーション基準

- **レベル1**: 軽微なエラー・警告 → システム管理者
- **レベル2**: 処理失敗・性能問題 → 技術担当者
- **レベル3**: システム停止・データ破損 → 緊急対応チーム

---

## 📚 関連ドキュメント

- `README.md`: システム全体概要
- `CHANGELOG.md`: 変更履歴
- `docs/testing.md`: テスト実行手順
- `scripts/`: 運用スクリプト一覧
- `monitoring-dashboard.html`: リアルタイム監視画面

---

## 🧪 E2E テスト実行手順（チェックリスト管理者アクセス制御）

### ⚠️ 重要: Vite 環境変数はビルド時に固定される

Vite は `import.meta.env.*` を**ビルド時**に埋め込むため、テスト実行時に環境変数を変更しても反映されません。

**正しい手順**: 環境変数を設定してビルド → その後テストを実行

### 1️⃣ PROD相当（fail-closed）の検証

```bash
# ビルド時に PROD 環境を埋め込み
VITE_DEMO_MODE=0 VITE_SCHEDULE_ADMINS_GROUP_ID= npm run build

# ビルド済みアーティファクトを使ってテスト実行
VITE_DEMO_MODE=0 VITE_SCHEDULE_ADMINS_GROUP_ID= PLAYWRIGHT_SKIP_BUILD=1 \
  npx playwright test 'checklist-admin-access' --project=smoke
```

**期待結果**:
- `/checklist` アクセス → 403エラー（env未設定のため）
- ナビゲーションにチェックリスト項目なし

### 2️⃣ DEMO（便利モード）の検証

```bash
# ビルド時に DEMO 環境を埋め込み
VITE_DEMO_MODE=1 npm run build

# ビルド済みアーティファクトを使ってテスト実行
VITE_DEMO_MODE=1 PLAYWRIGHT_SKIP_BUILD=1 \
  npx playwright test 'checklist-admin-access' --project=smoke
```

**期待結果**:
- `/checklist` アクセス → 正常表示（デフォルト管理者権限）
- ナビゲーションにチェックリスト項目あり

### 3️⃣ Production実行時（実際の管理者グループIDを使用）

```bash
# .env に実際のグループIDを設定してビルド
VITE_SCHEDULE_ADMINS_GROUP_ID=12345678-1234-1234-1234-123456789abc npm run build

# ビルド済みアーティファクトを使ってテスト実行
VITE_SCHEDULE_ADMINS_GROUP_ID=12345678-1234-1234-1234-123456789abc PLAYWRIGHT_SKIP_BUILD=1 \
  npx playwright test 'checklist-admin-access' --project=smoke
```

### 4️⃣ CI/CDでの実行例

`.github/workflows/test.yml`:

```yaml
strategy:
  matrix:
    env-mode:
      - name: prod-fail-closed
        VITE_DEMO_MODE: "0"
        VITE_SCHEDULE_ADMINS_GROUP_ID: ""
      - name: demo-convenience
        VITE_DEMO_MODE: "1"
        VITE_SCHEDULE_ADMINS_GROUP_ID: ""

steps:
  - name: Build with environment
    run: npm run build
    env:
      VITE_DEMO_MODE: ${{ matrix.env-mode.VITE_DEMO_MODE }}
      VITE_SCHEDULE_ADMINS_GROUP_ID: ${{ matrix.env-mode.VITE_SCHEDULE_ADMINS_GROUP_ID }}
      
  - name: Run tests
    run: npx playwright test 'checklist-admin-access' --project=smoke
    env:
      PLAYWRIGHT_SKIP_BUILD: "1"
```

### トラブルシューティング

#### ❌ 間違い: テスト実行時のみ環境変数を設定

```bash
# これは動作しません（ビルド済みアーティファクトに環境変数が埋め込まれていない）
VITE_DEMO_MODE=0 PLAYWRIGHT_SKIP_BUILD=1 npx playwright test ...
```

#### ✅ 正しい: ビルド → テストの2段階

```bash
# 1. 環境変数を設定してビルド
VITE_DEMO_MODE=0 npm run build

# 2. ビルド済みを使ってテスト
VITE_DEMO_MODE=0 PLAYWRIGHT_SKIP_BUILD=1 npx playwright test ...
```

---

**最終更新**: 2025年11月6日
**バージョン**: 1.0
**承認者**: システム管理者