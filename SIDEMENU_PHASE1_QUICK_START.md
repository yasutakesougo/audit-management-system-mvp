# 🚀 実装完全ガイド：段階1 を今すぐ実装（コピペ版）

> **予定時間**: 30分  
> **難易度**: 🟢 低  
> **対象**: エンジニア

---

## 📝 実装概要

```
ステップ1: コード変更（5分）
  ↓
ステップ2: テスト実行（10分）
  ↓
ステップ3: ビジュアル確認（5分）
  ↓
ステップ4: コミット＆プッシュ（5分）
  ↓
ステップ5: ユーザー向け案内送信（5分）
```

---

## 🔧 ステップ 1: コード変更

### 1-1. ファイルを開く

```bash
code src/app/config/navigationConfig.ts
```

### 1-2. 行番号 44-49 を以下に置き換える

**現在のコード** (L44-49):
```typescript
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '🗓 日次',
  record: '🗂 記録・運用',
  review: '📊 振り返り・分析',
  master: '👥 マスタ',
  admin: '🛡 管理',
  settings: '⚙️ 設定',
};
```

**置き換え後** (L44-49):
```typescript
/**
 * Navigation group labels with action-oriented wording
 * Updated 2026-02-23 for improved UX clarity
 * 
 * Emoji choices:
 * - 📌 (pin): emphasizes "everyday essentials"
 * - 📚 (books): archival/reference material
 * - 🔍 (magnifying glass): analysis/insight
 * - 👥 (people): master data (users/staff)
 * - ⚙️ (gear): system-level settings
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

### 1-3. ファイルを保存

```
Ctrl+S (Windows/Linux)
Cmd+S (Mac)
```

**完成！** コード変更は以上です。

---

## ✅ ステップ 2: テスト実行

### 2-1. TypeScript コンパイルチェック

```bash
npm run typecheck
```

**期待結果**:
```
✓ Checking TypeScript...
✓ Type checking passed
```

**エラーが出た場合**:
- コードをコピペする際に余分なスペースが入っていないか確認
- VS Code を再起動してみる

### 2-2. 単体テスト実行

```bash
npm test -- navigationConfig.spec.ts
```

**期待結果**:
```
PASS  tests/unit/app/config/navigationConfig.spec.ts
  navigationConfig
    ✓ should have groupLabel defined
    ✓ should have all required keys
```

**テストが失敗した場合**:
行番号 L44-49 のコードが正確にコピペされているか確認

### 2-3. 既存テスト全体を実行

```bash
npm test
```

**期待結果**:
```
Test Suites: X passed, 0 failed
Test Files:  X passed, 0 failed
Tests:       X passed, 0 failed
```

**失敗した場合**:
`git diff` でコード変更を確認し、余分な変更がないか確認

### 2-4. E2E スモークテスト実行

```bash
npm run test:e2e:smoke
```

**期待結果**:
```
✓ all specs passed
```

---

## 🖼️ ステップ 3: ビジュアル確認

### 3-1. 開発サーバーを起動

```bash
npm run dev
```

**出力例**:
```
>  ready - started server on 0.0.0.0:5173, url: http://localhost:5173
```

### 3-2. ブラウザで確認

ブラウザを開いて `http://localhost:5173` にアクセス

#### 3-3. 確認項目

- [ ] **デスクトップビュー（展開状態）**
  ```
  左サイドバーの見出しが以下になっているか
  📌 今日の業務
  📚 記録を参照
  🔍 分析して改善
  👥 利用者・職員
  ⚙️ システム管理
  ⚙️ 表示設定
  ```

- [ ] **デスクトップビュー（折りたたみ状態）**
  ```
  絵文字アイコンのみが表示されているか
  Hover で「今日の業務」というツールチップが表示されるか
  ```

- [ ] **モバイルビュー（≤600px）**
  ```
  ハンバーガーメニューをクリック
  メニューが開いて新しいラベルが表示されるか
  検索ボックスが表示されるか
  ```

- [ ] **ダークモード**
  ```
  右上の月アイコンをクリック
  テーマが切り替わっても（段階1では）見た目は同じか
  （注: 段階2 で色分けされるため、ここでは白/暗いテキストのまま）
  ```

- [ ] **ライトモード**
  ```
  同じラベルが表示されているか
  ```

### 3-4. 開発サーバーを停止

```bash
Ctrl+C
```

---

## 📤 ステップ 4: コミット＆プッシュ

### 4-1. 変更ファイルを確認

```bash
git status
```

**期待結果**:
```
modified:   src/app/config/navigationConfig.ts
(他に余分なファイルがないか確認)
```

### 4-2. ファイルをステージング

```bash
git add src/app/config/navigationConfig.ts
```

### 4-3. コミットメッセージ作成

```bash
git commit -m "feat(nav): improve menu labels with action-oriented wording

- daily: 日次 → 📌 今日の業務
- record: 記録・運用 → 📚 記録を参照
- review: 振り返り・分析 → 🔍 分析して改善
- master: マスタ → 👥 利用者・職員
- admin: 管理 → ⚙️ システム管理
- settings: 設定 → ⚙️ 表示設定

Improves UX clarity and action-awareness by using action verbs
and emoji for visual differentiation.

Related: #<issue-number> (あれば)
"
```

### 4-4. プッシュ

```bash
git push origin <branch-name>
```

**例**:
```bash
git push origin feature/sidemenu-ux-improvement-phase1
```

### 4-5. PR を作成

GitHub / GitLab で PR を作成

**PR テンプレート**:
```markdown
## 📝 Description
Navigation menu labels updated for improved UX clarity using action-oriented wording.

## 🎯 Changes
- Updated 6 group labels with action verbs and emoji
- No functional changes - UI improvement only
- i18n ready (NAV_GROUP_I18N_KEYS prepared for future)

## ✅ Testing
- [x] TypeScript: `npm run typecheck`
- [x] Unit tests: `npm test`
- [x] E2E smoke: `npm run test:e2e:smoke`
- [x] Visual: desktop/mobile/dark mode confirmed

## 📸 Before/After
[スクリーンショット添付]

## ⚠️ Notes
- Segment 1 of 3-phase rollout (Phase 1: label, Phase 2: colors, Phase 3: features)
- User communication planned for release day
```

---

## 📢 ステップ 5: ユーザー向け案内を送信

### 5-1. リリースノートDoc を準備

上記：[SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md](SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md) から以下をコピー：

- Email Template
- FAQ
- Slack/Teams メッセージ

### 5-2. 案内メールを送信

**送信先**: 全スタッフ + 施設長  
**送信日時**: 実装リリースの**前日**か**当日朝**  
**件名**: `📢 メニューが見やすくなりました！（2026-02-23 更新）`

**Email のコピペ**:
```
お疲れさまです。

本日よりメニューのラベルが変わります。
詳しくは下記をご覧ください。

【変更内容】
日次 → 📌 今日の業務
記録・運用 → 📚 記録を参照
振り返り・分析 → 🔍 分析して改善
マスタ → 👥 利用者・職員
管理 → ⚙️ システム管理
設定 → ⚙️ 表示設定

【重要】
• 機能は何も変わっていません
• 見た目（名前）が変わっただけです
• 特別な操作は不要です

ご不明な点は [担当者] までお知らせください。
```

### 5-3. FAQ を社内Wiki に公開

[SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md](SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md) の **FAQ セクション** を Wiki に追加

### 5-4. Slack / Teams に通知

上記テンプレートの **Slack メッセージ** をコピー＆ペースト

---

## 🎉 完了！ チェックリスト

### 実装チェック
- [ ] `navigationConfig.ts` が更新された
- [ ] `npm run typecheck` で エラーなし
- [ ] `npm test` で 全テスト PASS
- [ ] `npm run test:e2e:smoke` で PASS
- [ ] ブラウザで new labels が表示されている

### リリースチェック
- [ ] Git commit & push 完了
- [ ] PR が作成されている
- [ ] レビューリクエストを送信
- [ ] ユーザー向け案内メール送信済み
- [ ] FAQ を Wiki に追加

### 後続タスク
- [ ] PR がマージされる
- [ ] 本番環境へのデプロイ
- [ ] ユーザーフィードバック収集
- [ ] 段階2 の実装計画

---

## 🚨 トラブルシューティング

### Q1: TypeScript エラーが出た

```
Type 'string' is not assignable to type 'NavGroupKey'
```

**A**: コードをコピペする際に、余分なスペースや改行が入っていないか確認。
特に絵文字が崩れていないか確認してください。

### Q2: テストが失敗した

```
Expected: '📌 今日の業務'
Received: '🗓 日次'
```

**A**: ファイル保存後、 `npm test` 実行前に VS Code がファイルを認識しているか確認。
`npm test -- --clearCache` を実行してキャッシュをクリア。

### Q3: ブラウザに old labels が表示される

```
見えている: 🗓 日次（古い）
期待: 📌 今日の業務（新しい）
```

**A**: ブラウザキャッシュをクリア
- Chrome: `Ctrl+Shift+Delete`（Win）or `Cmd+Shift+Delete`（Mac）
- または `npm run dev` 時に Ctrl+Shift+R で hard refresh

### Q4: PR がマージされない

**A**: 以下を確認：
- [ ] コードレビューのコメントに対応
- [ ] CI が全て PASS している
- [ ] コンフリクトがないか確認

---

## 📞 サポート

実装中に質問があれば：

| 質問内容 | 対応 |
|---------|------|
| コード例がわからない | [SIDEMENU_PHASE1_IMPLEMENTATION_PATTERNS.md](SIDEMENU_PHASE1_IMPLEMENTATION_PATTERNS.md) を参照 |
| テストが失敗する | [SIDEMENU_TEST_ROADMAP.md](SIDEMENU_TEST_ROADMAP.md) を参照 |
| ユーザーへの説明は？ | [SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md](SIDEMENU_RELEASE_NOTES_USER_COMMUNICATION.md) を参照 |
| 次のステップは？ | [SIDEMENU_UX_OPTIMIZATION_ROADMAP.md](SIDEMENU_UX_OPTIMIZATION_ROADMAP.md) を参照 |

---

## ✨ 完了報告テンプレート

実装が完了したら、チームに以下を報告：

```markdown
## ✅ 段階1 実装完了報告

### 実施項目
- [x] navigationConfig.ts のラベル更新
- [x] テスト全て PASS
- [x] ビジュアル確認完了
- [x] PR マージ済み
- [x] ユーザー向け案内送信済み

### 変更ファイル
- src/app/config/navigationConfig.ts

### テスト結果
- TypeScript: ✅
- Unit tests: ✅
- E2E smoke: ✅

### デプロイ予定
- 本番環境: [日時]

### 次のステップ
- 段階2（ビジュアル強化）を [日時] に開始予定
```

---

## 🎯 まとめ

**段階1 は以下を実現する**：

✅ **短時間（30分）** で実装完了  
✅ **リスク最小化** （ラベル変更のみ）  
✅ **即座に UX 向上** （ユーザーがすぐに効果を実感）  
✅ **段階2/3 へのスムーズな移行** （i18n キーも準備済み）

---

**作成**: 2026-02-23  
**推奨開始日**: 今すぐ  
**予定完了日**: 今日中  
**難易度**: 🟢 低  
**リスク**: 🟢 低  
**効果**: 🔴 高

さあ、実装を始めましょう！🚀
