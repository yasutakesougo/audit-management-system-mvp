# リリースノート & ユーザー向けコミュニケーション

> **対象**: システム管理者、現場スタッフ  
> **公開タイミング**: 段階1 実装直後  
> **トーン**: 親切・わかりやすい

---

## 📋 内部用: 段階1 リリースノート（エンジニア向け）

```markdown
## Version 1.1.0 - Navigation UI Improvement (2026-02-23)

### Changes

#### Navigation Menu Labels (UX Improvement)

Reorganized navigation menu group labels for better clarity and action-oriented naming:

- **日次** → **📌 今日の業務**
  - Emphasizes daily operations that users interact with every day
  
- **記録・運用** → **📚 記録を参照**
  - Clarifies that this section is for browsing/referencing past records
  
- **振り返り・分析** → **🔍 分析して改善**
  - Action-oriented naming encourages data-driven decision making
  
- **マスタ** → **👥 利用者・職員**
  - Explicitly names the content instead of abstract term "master"
  
- **管理** → **⚙️ システム管理**
  - Clearer distinction of admin-only features
  
- **設定** → **⚙️ 表示設定**
  - Specificity: clarifies this controls display, not system settings

### Technical Details

- File: `src/app/config/navigationConfig.ts`
- Change: Updated `groupLabel` constant with emoji and action-oriented verbs
- I18n ready: Added `NAV_GROUP_I18N_KEYS` for future multi-language support
- Backward compatible: No API changes, UI-only improvement
- Test coverage: All existing tests pass

### Benefits

✅ **Improved UX**: Users can find features more intuitively
✅ **Reduced cognitive load**: Emoji + action verbs = faster recognition
✅ **Future-proof**: i18n keys prepared for multi-language rollout
✅ **Accessibility ready**: Can be enhanced with aria-labels in Phase 2

### Testing

- TypeScript: ✅ `npm run typecheck`
- Unit tests: ✅ `npm test`
- E2E smoke: ✅ `npm run test:e2e:smoke`
- Visual regression: Reviewed on desktop/mobile/dark mode

### Rollback Plan

If issues arise: `git revert <commit-hash>`
```

---

## 👥 ユーザー向け（現場スタッフ + 施設長）

### 📧 Email Template

**件名**: 📢 メニューが使いやすくなりました！（2026年2月23日更新）

```html
お疲れさまです。

いつもご利用いただきありがとうございます。

本日、【メニュー（サイドバー）】が改善されました。
「どこに何があるのか」がより見やすくなています。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ 何が変わった？

【メニュー名】が、より具体的でわかりやすくなりました。

  【変更前】       →       【変更後】
  ─────────────────────────────────────
  🗓️ 日次       →  📌 今日の業務
  🗂️ 記録・運用   →  📚 記録を参照
  📊 振り返り・分析 →  🔍 分析して改善
  👥 マスタ      →  👥 利用者・職員
  🛡️ 管理       →  ⚙️ システム管理
  ⚙️ 設定       →  ⚙️ 表示設定

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 各グループの役割

📌 【今日の業務】
毎日触る業務をここに集めました
• 日次記録、健康記録
• 申し送りタイムライン
• 朝会・夕会など

📚 【記録を参照】
過去の記録や資料を検索・確認する場所です
• 黒ノート、月次記録
• スケジュール確認

🔍 【分析して改善】
データを分析して、質の向上に活かす
• 分析ダッシュボード
• 氷山分析
• アセスメント

👥 【利用者・職員】
ユーザー情報と職員情報の管理
• 基本情報の参照・編集

⚙️ 【システム管理】（※ 管理者のみ）
システム運用に関する高度な機能
• 支援手順の設定
• 監査ログ確認

⚙️ 【表示設定】
画面の見た目をカスタマイズ
• ダークモード、レイアウト設定など

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

😊 使い方は変わっていません

✋ ご心配なく！
• 機能は一切変わっていません
• 見た目（名前）が変わっただけです
• いつもと同じように使えます

🔍 さらに、メニュー内には「検索機能」もあります
• メニュー左上の検索ボックスにキーワードを入力
• 「朝会」と入れれば → 朝会関連の機能がすぐ出てきます

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ ご質問・フィードバック

「こっちの方が見やすい！」
「でもこれは分かりにくい…」

などのご意見がありましたら、お気軽にお知らせください。
今後の改善に反映させていただきます。

ご不明な点があれば、\[担当者連絡先] までお気軽にお問い合わせください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

本件について：
📧 [担当者メール]   📞 [担当者電話]

今後ともよろしくお願いいたします。

[システム管理チーム]
```

---

### 📘 FAQ (よくある質問)

```markdown
## よくある質問 + 回答

Q1: 「メニューが変わった」と言ってくる職員がいます。どう説明すればいい？

A: こうお答えください：
「名前が変わっただけで、機能は全く同じです。
むしろ『何をするボタン』なのか、より見やすくなったんですよ。
試しに『📌 今日の業務』をクリックしてみてください。
以前の『日次』と同じ画面が出てきますから」

---

Q2: スマートフォンで見ると絵文字が小さく見えます。大丈夫ですか？

A: 大丈夫です。
絵文字は目印です。
重要なのは文字（「今日の業務」など）です。
目印が多少小さくても、文字で判断できます。

---

Q3: 新しい機能が追加されたんですか？

A: いいえ。メニューの名前が変わっただけです。
使える機能は以前と全く同じです。
むしろ「メニューが見やすくなった」という UX 改善です。

---

Q4: 何か不具合が起きたら？

A: 以下をお試しください：
1. ブラウザのキャッシュをクリア
   Chrome: 設定 → 閲覧履歴を削除 → キャッシュ/Cookie にチェック
2. ページをリロード（Ctrl+F5）
3. それでも直らない場合はお知らせください。

---

Q5: 「📌」とか絵文字が文字化けして見える場合は？

A: ブラウザを最新版に更新してください。
特に IE11 はサポートされていない場合があります。
推奨ブラウザ: Chrome, Safari, Edge の最新版

---

Q6: 今後また変わったりしますか？

A: 今後の改善予定があります：
- 【近日中】「セパレーター（線）」がもう少し見やすくなります
- 【予定中】好きなメニューを「お気に入い」として固定できる機能
- 【検討中】ショートカットキー（Cmd+K で検索）

引き続き、改善を続けていきますので、
ご意見をお待ちしています！
```

---

## 📋 施設長・マネージャー向け（1分版）

```markdown
【重要なお知らせ】重要度: 低（ユーザー向け案内のみ）

---

タイトル: メニューラベル改善について（2026-02-23）

概要:
- ユーザーのメニュー操作性を向上させるため、
  サイドメニューのグループ名を より具体的でアクション指向に変更しました

変更内容:
  日次 → 📌 今日の業務
  記録・運用 → 📚 記録を参照
  振り返り・分析 → 🔍 分析して改善
  マスタ → 👥 利用者・職員
  管理 → ⚙️ システム管理
  設定 → ⚙️ 表示設定

影響:
- UI のみの変更（機能変更なし）
- ユーザーの「どこに何があるか」という認識が改善される
- 特別な操作は不要

必要なアクション:
- スタッフへの案内メール送信（テンプレートは別紙）
- ご質問等あればお知らせください

---

以上です。特別な対応は必要ございません。
```

---

## 📱 In-App Notification（画面内通知）

**使用例**: AppShell.tsx に Alert Banner を追加

```typescript
// src/app/AppShell.tsx（オプション - 1週間の一時表示用）

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

// 1週間の間だけ表示（環境変数で制御）
const showMenuUpdateNotification = readBool('VITE_SHOW_MENU_UPDATE_NOTIFICATION', true);

return (
  <>
    {showMenuUpdateNotification && (
      <Alert 
        severity="info" 
        onClose={() => dismissNotification()}
        sx={{ mb: 2 }}
      >
        <AlertTitle>📌 メニューが見やすくなりました</AlertTitle>
        サイドメニューのラベルが改善されました。
        詳しくは<a href="/help/menu-update">こちら</a>をご覧ください。
      </Alert>
    )}
    {/* 既存の content */}
  </>
);
```

---

## 📊 効果測定（オプション）

```typescript
// Google Analytics で追跡（オプション）

// ページ訪問の「メニューグループ別」の遷移を分析
// 「📌 今日の業務」へのアクセス頻度が増えたか？
// 「⚙️ システム管理」の誤操作が減ったか？

// Hotjar や Fullstory で「ユーザー行動」を可視化
// → セッションリプレイで、ユーザーがどう迷うかを観察
```

---

## 🎁 テンプレート集（コピペ用）

### Slack 通知

```
📢 メニューが見やすくなりました！

グループ名が変わって、より見やすくなりました：

📌 今日の業務（日次 → 新名）
📚 記録を参照（記録・運用 → 新名）
🔍 分析して改善（振り返り・分析 → 新名）
👥 利用者・職員（マスタ → 新名）
⚙️  システム管理（管理 → 新名）
⚙️  表示設定（設定 → 新名）

機能は変わっていません。見た目が見やすくなっただけです！
```

### Teams メッセージ

```
🎉 UI 改善 - メニュー更新

本日、メニューラベルを改善しました。

変更内容: 6 つのグループ名が、より分かりやすい名前になりました。

👉 詳細は [こちらのドキュメント（リンク）] をご覧ください

特別な操作は必要ありません。
ご不明な点はお気軽にお問い合わせください！
```

---

## ✅ リリース前チェックリスト

- [ ] ユーザー向けメール案内文を確認
- [ ] FAQ を現場リーダーと共有
- [ ] スクリーンショット（変更前後）を用意
- [ ] In-App Notification（オプション）をテスト
- [ ] ヘルプページ/Wiki を更新
- [ ] サポートチームに情報を共有
- [ ] フィードバック収集フォームをセットアップ

---

**作成**: 2026-02-23  
**対象**: ユーザー・施設長・サポートチーム  
**推奨配信日**: 段階1 実装の 1-2 日前（心構え）
