# Task Specification: 支援手順インポーターUX改善 🛠️

## 1. 目的・背景
`ImportTemplateDialog` の「テンプレートから取り込み」画面は、現状CSV選択に寄っており、CSVの仕様やサンプルダウンロード、および内蔵マスタの適用導線が不足しているため、現場の職員（初見のユーザー）が迷いやすい（バラバラ感がある）というUX上の課題を抱えています。
本タスクでは、**「PR連携型インポート＝恒久マスタ登録」** と **「UIインポート＝一時検証」** の役割分担を画面上で明確に示し、迷わず安全に手順を取り込めるプレミアムなUIへとアップグレードします。

---

## 2. 実装スコープ・要件

### 1) ImportTemplateDialog.tsx の2タブ化
ダイアログの上部に `MUI Tabs` を導入し、以下の2つの取り込みルートにUIを分離します。
* **タブ1**: 「標準テンプレートから選択（推奨）」
* **タブ2**: 「CSVファイルからインポート」

### 2) タブ1: 「標準テンプレートから選択」の実装
* `userProcedureDetails.ts` に定義されている、内蔵の17行マスタデータを利用者ID（`userId`）に応じて適用できるワンクリック適用ボタンを配置します。
* 対象利用者のマスタデータが未登録の場合は、エラーで落とさず「標準テンプレート未登録」と分かりやすく表示します。
* 既存の手順データが上書きされる可能性がある場合は、適用前に上書き確認のアラート（Warning）を表示します。

### 3) タブ2: 「CSVファイルからインポート」の実装
* 画面内にCSVの構成列（ヘッダーカラム名）の仕様をヘルプテーブルで明示します。
  - `RowNo` (任意: 手順の並び順)
  - `活動内容` (**必須**: 手順内容のベース)
  - `本人の動き` (任意: 活動内容と自動結合)
  - `支援者の動き` (任意: 担当スタッフ)
  - `時間帯` (任意: タイミング)
* そのままExcel等で編集してインポート可能な **サンプルCSVのダウンロードボタン** を追加します。
  - 日本語文字化け（Excel等で開く際）を避けるため、**UTF-8 BOM付き** (`0xEF, 0xBB, 0xBF`) の Blob で CSV バイナリを動的生成・ダウンロード可能にします。
* 既存の `PapaParse` によるCSVパース挙動および変換ロジックは壊さず維持します。

### 4) 2つのインポートルートの役割分担の明示
ダイアログの上部または説明欄に、以下の役割分担（インセプションガイド）を明記します。
> 💡 **恒久的な標準手順の登録**は、管理者による「Excel原紙 → MarkItDown → マスタ追加 → テスト → PR」のワークフローで行います。
>
> 💻 **この画面のCSV取り込み**は、編集中の支援計画シートへ一時的に手順を差し込んで確認するための機能（一時検証・下書き用）です。

### 5) 支援手順の取り込みガイド（docsヘルプリンク）の設置
* ダイアログ内の見やすい位置に、管理者向けの「PR連携マスタ登録手順」を解説している公式ドキュメント **`docs/guides/support-procedure-addition-guide.md`**（支援手順追加ガイド）への参照、または **「❓ 取り込みガイドを確認」** のようなガイドリンク（ヘルプボタン）を設置します。
* これにより、一般の現場職員が「Excelから恒久的にシステムに手順を反映したい」と考えた際に、迷わず公式のPRデプロイルートを参照して管理者と連携できるように促します。

---

## 3. ガードレール・制約事項（厳守）
* `dailyProcedureMapper.ts` は原則として一切変更しない（L2→L3変換ロジック本体は変更しない）。
* SharePointへの書き込み・保存仕様は変更しない。
* UX改善に限定し、1つのクリーンなPRで完結する小さな差分（デグレーションをゼロにする）に抑えること。

---

## 4. 受け入れ条件（Acceptance Criteria）
* 「テンプレートから取り込み」ダイアログを開いた時点で、恒久登録と一時取り込みの違いが直感的に理解できること。
* CSVの列仕様がコードやADRを読まなくても画面上で理解できること。
* サンプルCSVをBOM付きで正常にダウンロードできること。
* 既存のCSVパースとインポートが壊れず動作すること。
* 内蔵マスタがある利用者（デモユーザー等）では標準手順を一発適用できること。
* 内蔵マスタがない利用者でも画面が壊れないこと。
* `dailyProcedureMapper.ts` の仕様テストおよび既存テストがすべて `PASS` すること。

---

## 5. 検証コマンド
実装完了後、以下の検証を実施し、すべてクリアすることを確認してください：
```bash
npm run typecheck
npx vitest run src/features/planning-sheet
npx vitest run src/features/planning-sheet/logic/__tests__/dailyProcedureMapper.spec.ts
git diff --check
```

---

## 6. PR情報テンプレート

* **ブランチ名**: `feat/planning-sheet-support-procedure-import-ux`
* **PRタイトル**: `feat(planning-sheet): improve support procedure import UX`
* **対象ファイル**:
  - `src/features/planning-sheet/components/ImportTemplateDialog.tsx`
  - `src/features/planning-sheet/components/EditablePlanningDesignSection.tsx`
  - `src/features/planning-sheet/bridge/supportTemplateBridge.ts`
  - `src/features/planning-sheet/constants/userProcedureDetails.ts`
  - 関連するテストファイル

### PR説明欄 (Description)
```markdown
## Summary
- 支援手順インポートダイアログを2タブ構成に改善
- 内蔵標準テンプレート（userProcedureDetails）のワンクリック適用導線を追加
- CSVの仕様説明テーブルと、BOM付きサンプルCSVのダウンロード機能を追加
- 画面上に「Excel→PR（恒久マスタ）」と「UI（一時検証）」の役割分担を明示

## Scope
- UX改善のみ
- L2→L3変換ロジック、およびSharePoint保存仕様は変更なし

## Checks
- npm run typecheck (PASS)
- npx vitest run src/features/planning-sheet (PASS)
- npx vitest run src/features/planning-sheet/logic/__tests__/dailyProcedureMapper.spec.ts (PASS)
- git diff --check (PASS)
```
