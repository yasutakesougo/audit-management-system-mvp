---
name: "🚀 MVP 受け入れチェックリスト"
about: "運営指導（監査対応）記録管理システム MVP の完了条件を段階的にチェックする"
title: "[MVP] 受け入れチェック"
labels: ["mvp", "checklist"]
assignees: []
---

# ✅ MVP 受け入れチェックリスト

この Issue は、MVP 実装の進捗を **チェックボックス方式** で追跡するためのテンプレートです。  
完了したらチェックを入れて進めてください。

---

## 1. ローカル動作
- [ ] `.env` に実値を設定  
- [ ] `npm ci && npm run dev` 起動  
- [ ] サインイン成功 → 「日次記録」の一覧取得ができる  
- [ ] Title 入力＋追加 → 一覧に反映される  
- [ ] 監査ログに `CREATE_SUCCESS` が記録される  

## 2. SharePoint プロビジョニング
- [ ] Actions → Provision ワークフローを `whatIf:true` で実行し差分確認  
- [ ] 差分問題なしなら `whatIf:false` で本実行  
- [ ] Job Summary に `Created/Updated/Migration done` が出力される  

## 3. 監査ログ同期
- [ ] AuditPanel → 「SPOへ同期」ボタン押下  
- [ ] `Audit_Events` リストに行が生成される  
- [ ] 同期成功後にローカルログがクリアされる  

## 4. CI / テスト
- [ ] `npm run test:coverage` がローカルで成功  
- [ ] CI ワークフローがグリーン（型チェック・カバレッジ閾値クリア）  
- [ ] `coverage/lcov.info` がアーティファクトとして保存される  

## 5. リトライ・診断
- [ ] 401/403 発生時に自動で 1 回再試行されることを確認  
- [ ] エラー出力に `SPRequestGuid` が含まれる  

## 6. ドキュメント整合
- [ ] README と `docs/provisioning.md` が現行仕様と一致  
- [ ] schema.xml の更新手順（PnP テンプレート、internalName・Choice 方針）が記載されている  

## 7. 受け入れ / E2E（任意）
- [ ] 手動チェックリストを通して全体動作を確認  
- [ ] （任意）Playwright/E2E で「サインイン→一覧→追加→監査ログ表示」を自動化  

---

### 備考
- `forceTypeReplace:true` を使う場合は必ず `whatIf:true` で影響を事前確認  
- `recreateExisting:true` はデータ消失に注意（事前バックアップ必須）
