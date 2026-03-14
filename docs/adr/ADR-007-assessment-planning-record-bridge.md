# ADR-007: Assessment → Planning → Record Bridge

- **Status**: Accepted
- **Date**: 2026-03-14
- **Authors**: Development Team

## Context

### 課題

障害福祉サービスの支援記録では、アセスメント情報を支援計画シートに手動転記し、
さらに計画の方針を日次の手順書兼記録に手動で落とし込む必要があった。

この手動プロセスには以下の問題があった。

- **転記漏れ・不整合**: 手動コピーによる抜け落ちやバージョンズレ
- **説明不能**: ある値がなぜ入ったか後から追跡できない
- **二重入力リスク**: 複数職員が同じ内容を別々に入力する可能性
- **監査対応の困難**: 「いつ・誰が・何を取り込んだか」の記録がない

### 要件

- 既存の手動入力を妨げないこと
- 取込のたびに根拠と出典を記録すること
- 同じデータの再取込で重複しないこと
- 取込履歴を追跡可能にすること

## Decision

**2段階ブリッジ構造 + 4層説明責任** を採用する。

### 2段階ブリッジ

```
アセスメント ──(assessmentBridge)──→ 支援計画シート
支援計画シート ──(planningToRecordBridge)──→ 手順書兼記録
```

### 設計原則

1. **純関数ブリッジ**: 変換ロジックは副作用なしの純関数で実装し、
   UI コンポーネントから独立してテスト可能にする。

2. **追記マージ（上書きしない）**: 既存テキストの後に追記する。
   職員が手動で入力した内容は決して消さない。

3. **冪等性**: 同一データの再取込で重複しない。
   instruction 先頭30文字での照合による重複検出。

4. **Provenance（出典追跡）**: 全変換に `ProvenanceEntry` を生成。
   フィールド・出典・変換理由・値・日時を記録。

5. **プレビュー → 実行**: 取込前に必ずダイアログでプレビューを表示。
   「勝手に入った」感覚を防止する。

### 4層説明責任

| 層 | コンポーネント | 役割 |
|---|---|---|
| ① 取込 | assessmentBridge / planningToRecordBridge | 安全なデータマージ |
| ② 根拠 | ProvenanceEntry / ProvenanceBadge | なぜ入ったか |
| ③ 可視 | ProvenanceBadgeGroup / ProcedurePanel バッジ | どこ由来か |
| ④ 追跡 | ImportHistoryTimeline / importAuditStore | いつ誰が |

### 技術選定

- **ブリッジ関数**: TypeScript 純関数（React 非依存）
- **UI**: MUI Dialog / Chip / Accordion
- **永続化**: localStorage + Zustand（importAuditStore）
- **テスト**: Vitest + React Testing Library

## Consequences

### 良い結果

- **説明線が一本でつながる**: アセスメントから手順書まで provenance が追跡可能
- **テスト容易性**: 純関数ブリッジは78テスト全パスを維持
- **段階的導入**: 既存画面への影響が最小限（バッジ追加のみ）
- **冪等性**: 現場での誤操作に耐える
- **拡張性**: 新しいブリッジ（例: モニタリング → 計画更新）を同じパターンで追加可能

### トレードオフ

- **localStorage 依存**: 端末間で取込履歴が共有されない
  - 将来 Firestore / SharePoint に移行可能（importAuditStore のインターフェースは変更不要）
- **部分取込未対応**: 現時点では全項目一括取込のみ
  - フィールド選択UIは将来拡張として検討
- **Undo 未対応**: 取込の取消機能はない
  - 保存前であれば手動編集で対処可能

### 影響範囲

| 変更 | ファイル数 | 新規テスト |
|---|---|---|
| 新規ファイル | 7 | 78件 |
| 変更ファイル | 5 | — |
| ドキュメント | 4 | — |

## References

- [ADR-005: ISP 三層分離](ADR-005-isp-three-layer-separation.md)
- [ADR-006: 画面責務境界](ADR-006-screen-responsibility-boundaries.md)
- [Bridge 概要図](../guides/bridge-overview.md)
- [Bridge 運用ガイド](../guides/bridge-operations-guide.md)
