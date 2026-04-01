# Logic Purity Standard (Phase 2)

本文書は、Audit Management System における「Fat Hook（フックの肥大化）」と「副作用の混入」を防ぐための設計基準を定義します。

## 1. Hook は「状態と接続」のみ
Hook (`useXXX`) は React のライフサイクル、状態管理、依存解決（Repository）への **Gateway** に徹します。

- **役割**: `useState`, `useEffect`, `useContext`, `useMemo` による状態の保持と Repository への接続
- **禁止事項**: 
  - 複雑なビジネス計算ロジック（算出）の混入
  - 条件分岐の多いデータ変換
  - 直接的な API Fetch 呼び出し

## 2. Pure Function は「計算」のみ
計算ロジックは、React に依存しない純粋関数（Pure Function）として `domain/` または `utils/` に抽出します。

- **役割**: `Data -> Data` への変換。入力値が同じなら必ず同じ結果を出す。
- **メリット**: 
  - 単体テスト（Vitest）が容易
  - UI ライフサイクルに関係なく再利用可能
- **禁止事項**:
  - `window`, `localStorage`, `api` への外部アクセス
  - 引数以外の外部変数の参照

## 3. Orchestrator は「配線」のみ
Orchestrator は、複数の Hook からの状態と Pure Function による計算を物理的に「繋ぐ」役割を果たします。

- **役割**: 
  - A フックの戻り値を B 関数の入力へ流し込む
  - イベントハンドラに Repository の `save` をバインドする
- **禁止事項**:
  - Orchestrator 自体の中に `if` や `for` を使った複雑なロジックを書かない
  - 新たなローカル状態（state）を持たせない（原則、下位 Hook の合成のみ）

---
### 設計運用
「これ、コード量増えてない？」と感じるかもしれませんが、それが **「責務の分離」** です。
分離することで、テストが壊れにくくなり、DI 違反のような構造欠陥を早期に発見できるようになります。
