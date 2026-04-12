# Document Ingestion with MarkItDown

このドキュメントでは、各種文書（Excel, Word, PDF等）を AI が理解しやすい Markdown 形式に変換し、システムのナレッジベースに取り込む手順を説明します。

## 概要
`markitdown` (Microsoft) を活用し、構造化された文書を「液状化（Liquefaction）」して AI 解析可能な状態にします。

## ディレクトリ構成
- `knowledge/source_documents/`: 原本（Excel, PDF等）を格納
- `knowledge/ingested/`: 変換後の Markdown を格納
  - `official_forms/`: サービス提供実績記録票などの帳票
  - `audit_manuals/`: 自治体監査マニュアル等
  - `meeting_notes/`: 会議記録等
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

#### 監査マニュアル（PDF等）を変換する場合
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/manual.pdf --type audit_manual
```

#### ディレクトリ内の全ファイルを一括変換する場合
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/ --type official_form
```

#### 実行内容を確認する場合（Dry Run）
```bash
python scripts/ingest/convert-with-markitdown.py --source knowledge/source_documents/ --type official_form --dry-run
```

## 運用ルールと仕様

### 1. 命名規則
変換後のファイル名は、原則として `[原本ファイル名].md` となります。
将来的にバージョン管理が必要な場合は、`YYYYMMDD_[原本名].md` の形式を検討してください。

### 2. 対応拡張子と処理対象
スクリプトは以下の拡張子を自動認識します。
- **Documents**: `.xlsx`, `.docx`, `.pptx`, `.pdf`
- **Images**: `.jpg`, `.png` (OCR/EXIF解析対象)

### 3. 上書き動作
デフォルトでは同名のファイルがある場合、**常に最新の変換結果で上書き**されます。
原本を修正して再変換するワークフローを想定しているためです。

### 4. 変換の限界と注意点（失敗時の扱い）
- **原本保持の原則**: Markdown は解析用の二次データであり、原本（Source Document）は必ずそのまま保持してください。
- **帳票型 Excel**: 複雑なセル結合やレイアウト重視の Excel は、表構造が崩れたり、データが線形に並ぶ場合があります。
- **高密度 PDF**: カラムが分かれている PDF などは、読み順が前後することがあります。
- **手修正の推奨**: AI 解析の精度を極限まで高めたい場合は、変換後の Markdown を目視確認し、ヘッダー階層や表構造を軽く修正することを推奨します。

---
*Created by [Antigravity] as part of the DES Ingestion Pipeline Prototype.*
