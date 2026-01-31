# PR Merge Checklist

リリース運用の事故防止。PR 作成 → マージ → 次タスク までの標準フロー。

---

## ✅ PR-A / PR-B 作成後チェックリスト（本番運用版）

### 1️⃣ PR 作成直後（30秒で確認）

```
□ compare URL から作成（Base/Head 事故を予防）
  - PR-A: /compare/main...fix/appshell-role-sync-infinite-loop-guard
  - PR-B: /compare/main...feat/schedules-create-event-modal-demo

□ Base が main になっている ← compare URL なら確実
□ Labels が入っている
  - PR-A: bugfix, test, docs
  - PR-B: test （+ enhancement は任意）

□ Assignees / Reviewers は必要に応じて付与
```

### 2️⃣ CI 待機（1～3分）

```
□ Required checks が表示される（例：11/11）
□ ステータス："queued" → "in progress" → "success" を確認
  ⚠️ 失敗時：最初の failing job だけ開く（雪崩式デバッグ禁止）
```

### 3️⃣ マージ実行（事故防止）

```
□ PR-A → PR-B の順でマージ（依存薄いが、スモーク安定性で推奨）
□ Squash merge 推奨（履歴クリーン）
□ "Confirm merge" を押す
```

### 4️⃣ ブランチ削除（後片付け）

```
□ GitHub: "Delete branch" を押す（自動削除がない場合）
□ ローカル同期：
  git fetch -p
  git branch --merged main
  
□ main が最新状態の確認：
  git switch main
  git pull origin main
```

---

## 🎯 次タスク着地点（#6 / #7）

マージが完全に揃ったら：

```
1️⃣ #6: 412 ConflictDialog 実装
   - API 412 レスポンス → Dialog 表示
   - Reload / Discard / Overwrite ボタン
   - 状態反映 + UX 検証

2️⃣ #7: Feature Flag 統一
   - VITE_FEATURE_SCHEDULES / SCHEDULES_CREATE → 単一フラグに
   - Demo / CI / E2E 全環境で安定
```

---

## 📋 設計ポイント

このチェックリストが事故防止できるのは以下の理由：

| ポイント | 効果 |
|---------|------|
| compare URL 前提 | Base/Head 事故を物理的に潰している |
| CI 失敗時の行動制限 | 雪崩デバッグ防止（最初の failing job のみ追跡） |
| PR 順序の明文化 | 依存が薄くても "安定性優先" を共有 |
| 削除まで含めた定義 | 技術的負債（死んだブランチ）が残らない |
| 次タスクを明示 | マージ後に人が止まらない |

---

## 参考

- [PLAYWRIGHT_SMOKE_RUNBOOK.md](./PLAYWRIGHT_SMOKE_RUNBOOK.md) — スモークテスト実行の段取り
- [operations-runbook.md](./operations-runbook.md) — オペレーション全般
