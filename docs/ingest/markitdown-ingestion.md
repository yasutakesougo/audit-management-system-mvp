# Document Ingestion with MarkItDown (v0.2)

このドキュメントでは、各種文書（Excel, Word, PDF等）を AI が理解しやすい Markdown 形式に変換し、システムのナレッジベースに取り込む手順を説明します。

## 概要
`markitdown` (Microsoft) を活用し、構造化された文書を AI 解析可能な Markdown へ変換します。
v0.2 では、大量の文書を効率的に管理するための「観測性（Observability）」と「インクリメンタル処理」が追加されました。

## ディレクトリ構成
- `knowledge/source_documents/`: 原本（Excel, PDF等）を格納
- `knowledge/ingested/`: 変換後の Markdown を格納
  - `official_forms/`: サービス提供実績記録票などの帳票
  - `audit_manuals/`: 自治体監査マニュアル等
  - `meeting_notes/`: 会議記録等
  - `_reports/`: 変換実行ごとのレポート (JSON/Markdown)
- `scripts/ingest/`: 変換用スクリプト

## セットアップ
Python 環境が必要です。

```bash
pip install -r scripts/ingest/requirements.txt
```

## 変換手順

### 1. 原本の配置
`knowledge/source_documents/` に原本ファイルを配置します。

### 2. スクリプトの実行

#### 公式帳票（Excel等）を変換する場合
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/sample.xlsx --type official_form
```

#### ディレクトリ内の全ファイルを一括変換する場合
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/ --type official_form
```

#### 強制的に再変換する場合（Incremental Skip の無効化）
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/ --type audit_manual --force
```

## v0.2 の新機能と仕様

### 1. 観測性レポート (Run Reports)
実行ごとに `knowledge/ingested/_reports/` にレポートが出力されます。
- **JSON レポート**: システム連携用。各ファイルの成功・失敗・所要時間を記録。
- **Markdown レポート**: 人間が確認用。失敗したファイルとエラー内容を一覧化。

これにより、「どの帳票が変換に失敗しやすいか」を容易に特定できます。

### 2. インクリメンタル処理 (Incremental Processing)
無駄な再変換を避けるため、以下の条件で処理をスキップします。
- 出力先の Markdown が既に存在する
- かつ、原本の更新時刻が Markdown の生成時刻以前である
- かつ、`--force` オプションが指定されていない

### 3. メタデータの拡張 (Frontmatter)
生成される Markdown には以下のメタデータが付与され、将来の監査やレビューに活用されます。
- `source_path`: リポジトリルートからの相対パス
- `source_modified_at`: 原本の最終更新時刻
- `run_id`: 変換を実行したセッション ID
- `review_status`: `pending` (初期値)
- `tags`: 文書種別に応じた自動タグ (`official`, `audit`, `meeting`)

### 4. 対応拡張子とフィルタリング
以下の拡張子をサポートしています。
- `.xlsx`, `.docx`, `.pptx`, `.pdf`, `.jpg`, `.jpeg`, `.png`

Office の一時ファイル（`~$` で始まるもの）や `.DS_Store` などのシステムファイルは自動的に除外されます。

## 運用ルール

- **原本保持の原則**: Markdown は解析用の二次データであり、原本（Source Document）は必ずそのまま保持してください。
- **失敗時の扱い**: 変換に失敗したファイルがあっても、スクリプトは他のファイルの処理を続行します（fail-soft）。失敗理由はレポートで確認し、必要に応じて原本の形式を調整してください。

---
*Updated by [Antigravity] - Phase 2: Observability & Incremental Ingestion.*
