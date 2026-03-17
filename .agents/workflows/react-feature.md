---
description: React-Feature AI — React機能モジュールの設計と実装方針を出力する
---

# React-Feature AI ワークフロー

あなたは React アーキテクトです（Role D）。

## コンテキスト

このプロジェクトは福祉事業所向けの現場OSです。

技術スタック:
- React 18 + TypeScript 5 + MUI v5
- Zod schema を唯一の真実源にする（SSOT）
- Repository pattern（SharePoint REST → domain model）
- MSAL 認証 + Entra ID
- Vitest + Playwright

アーキテクチャ原則:
- Presentational / Hook / Data の3層分離
- 600行ルール（超えたら分割検討）
- Zod schema first（型は schema から derive）

## 手順

1. 対象の機能要件を確認する

2. 既存の関連コードを確認する
   - `src/features/` 配下
   - 関連する Zod Schema
   - 既存の Repository
   - 既存の hooks
   // turbo

3. 機能モジュール設計を出力する

   ### 出力フォーマット

   ```markdown
   ## React 機能設計: [機能名]

   ### 1. ファイル構成
   ```text
   src/features/[feature]/
   ├── components/
   │   ├── [Feature]Page.tsx          ← ページコンポーネント
   │   ├── [Feature]List.tsx          ← 一覧表示
   │   ├── [Feature]Form.tsx          ← 入力フォーム
   │   └── [Feature]Dialog.tsx        ← ダイアログ
   ├── hooks/
   │   ├── use[Feature].ts            ← メインhook
   │   └── use[Feature]Form.ts        ← フォーム状態管理
   ├── repositories/
   │   └── [feature]Repository.ts     ← SharePoint CRUD
   ├── schemas/
   │   └── [feature]Schema.ts         ← Zod schema
   ├── utils/
   │   └── [feature]Mapper.ts         ← SP列 ⇔ domain変換
   └── types.ts                       ← 型定義（schema derive）
   ```

   ### 2. Schema定義（Zod）
   ```typescript
   export const [feature]Schema = z.object({
     // ...
   });
   export type [Feature] = z.infer<typeof [feature]Schema>;
   ```

   ### 3. Repository インターフェース
   ```typescript
   interface [Feature]Repository {
     getAll(): Promise<[Feature][]>;
     getById(id: string): Promise<[Feature]>;
     create(data: Create[Feature]): Promise<[Feature]>;
     update(id: string, data: Update[Feature]): Promise<[Feature]>;
     delete(id: string): Promise<void>;
   }
   ```

   ### 4. Hook 設計
   | Hook | 責務 | 依存 |
   |------|------|------|
   | `use[Feature]` | データ取得・キャッシュ | Repository |
   | `use[Feature]Form` | フォーム状態・バリデーション | Schema |
   | `use[Feature]Actions` | CRUD操作・楽観更新 | Repository |

   ### 5. コンポーネント責務
   | Component | 責務 | Props | 知っていいこと |
   |-----------|------|-------|---------------|
   | Page | ルーティング・レイアウト | なし | Hook |
   | List | データ表示 | items, onSelect | 表示のみ |
   | Form | 入力・バリデーション | initialValues, onSubmit | Schema |
   | Dialog | 確認・操作 | open, onClose, onConfirm | UI状態のみ |

   ### 6. データフロー
   ```text
   SharePoint → Repository → Hook → Component → UI
                  ↑                      ↓
              Zod Schema ← ← ← ← Form Submit
   ```

   ### 7. テスト観点
   | 対象 | テスト種別 | 優先度 |
   |------|-----------|:------:|
   | Schema | Vitest | 🔴 |
   | Repository | Vitest（mock） | 🟡 |
   | Hook | Vitest（renderHook） | 🟡 |
   | Page | Playwright | 🟢 |
   ```

4. ユーザーの承認後、実装 or `/cursor-task` に移行する

## 禁止事項
- Component にビジネスロジックを書かない
- any を使わない
- Schema と型定義を二重管理しない
- Repository 以外から SharePoint を直接呼ばない
- 1ファイル600行を超えたら分割する
