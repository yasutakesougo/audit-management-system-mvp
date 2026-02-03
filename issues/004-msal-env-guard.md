# 📌 MSAL 設定健全性ガード（env schema）

## 目的（なぜやるか／価値）

Redirect URI や Authority などの設定ミスを起動時に検知し、環境差異による事故を防ぐ。

MSAL の設定（Redirect URI, Tenant ID, Client ID など）は、環境ごとに異なる値が必要です。設定ミスがあると、認証が失敗し、アプリケーションが利用不可能になります。起動時に設定を検証することで：

- **事故防止**: 本番環境での設定ミスによる障害を未然に防ぐ
- **早期検出**: 開発環境でも設定の不整合を即座に発見
- **明確なエラー**: 何が間違っているか具体的に表示
- **ドキュメント効果**: スキーマ定義が必要な環境変数のドキュメントになる

## 受け入れ基準（Definition of Done）

- [ ] zod を使った環境変数バリデーションスキーマを実装
- [ ] MSAL 関連の環境変数（VITE_MSAL_CLIENT_ID, VITE_MSAL_TENANT_ID など）を検証
- [ ] Redirect URI のフォーマットバリデーションを実装（URL 形式チェック）
- [ ] 不正値があると `npm run dev` 時にエラーで停止する
- [ ] エラーメッセージに具体的な修正方法を含める
- [ ] 既存の `src/lib/env.ts` と統合する

## 目安工数

- [x] S（小）
- [ ] M（中）
- [ ] L（大）

## タスク例

- [ ] `src/lib/envSchema.ts` を作成
  - zod スキーマを定義
  - MSAL 関連の環境変数を列挙
  - URL フォーマット検証を追加
- [ ] `src/lib/env.ts` に envSchema を統合
  - スキーマバリデーションを実行
  - エラー時は console.error で詳細を出力
  - エラー時は throw で起動を停止
- [ ] `npm run dev` でバリデーションが実行されることを確認
- [ ] 不正な値を設定してエラーメッセージを確認
- [ ] `.env.example` を更新して必須環境変数を文書化

## 備考

関連ファイル:
- `src/lib/env.ts` - 現在の環境変数アクセサ
- `.env.example` - 環境変数のサンプル
- `src/config/msalConfig.ts` - MSAL 設定

参考:
- [Zod Documentation](https://zod.dev/)
- [Vite 環境変数とモード](https://vitejs.dev/guide/env-and-mode.html)
- `ARCHITECTURE_GUARDS.md` - アーキテクチャガード方針

環境変数の例:
```
VITE_MSAL_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MSAL_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/{tenant}
```

検証項目:
- Client ID: UUID 形式
- Tenant ID: UUID 形式または "common", "organizations", "consumers"
- Redirect URI: 有効な URL 形式
- Authority: https:// で始まる URL
