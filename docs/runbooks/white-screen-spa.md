# SPA 白画面 障害 再発防止 Runbook

対象: Cloudflare Workers + Vite + React SPA  
最終更新: 2026-02-04  
影響: iPad Safari / Android Chrome（一部端末）

---

## 1. 事象サマリ
- 症状: /dashboard が白画面になる
- 原因の複合:
  1. HTML が返っていない / Body が欠落（Worker 側）
  2. 古い JS を参照（キャッシュ）
  3. Safari/古め Chromium で ES 構文未対応
- 結果: React が初期化前に落ち、画面が描画されない

---

## 2. 早期判定（30秒）
URL に ?b=1 を付けて開く

/dashboard?b=1

左上の boot beacon を確認：

表示 | 意味
---|---
boot:html-ok | HTML 配信 OK
boot:dom-ok | DOM + 初期JS OK
boot:error ... | JS 実行エラー（原因確定）
出ない | HTML 未配信 / キャッシュ / 別ホスト

👉 boot:dom-ok が出れば白画面原因はほぼ解消

---

## 3. 恒久対策（必須）

### A. キャッシュ戦略（最重要）
- HTML (/, /index.html, SPA ルート):
  - Cache-Control: no-store
- Assets (/assets/*):
  - Cache-Control: public, max-age=31536000, immutable

方針：HTML は常に最新、JS は指紋付きで強キャッシュ

### B. Worker 側の配信保証
- SPA ルートは必ず index.html を 200 で返す
- redirect / rewrite 時も body を失わない
- Content-Type: text/html を明示

### C. ビルド互換性
- Vite build target:
  - ['es2019', 'safari13']
- modulePreload.polyfill = true
- 必要時のみ @vitejs/plugin-legacy を使用（過剰導入しない）

---

## 4. デプロイ前チェックリスト（5分）
- npm run build がローカルで成功
- wrangler deploy のログに Error なし
- curl /dashboard で HTML が返る
- 実機（Android / iPad）で boot:dom-ok

---

## 5. 障害時の即応フロー
1. ?b=1 付きで確認
2. boot:error の全文を取得（120文字）
3. 分類：
   - HTML なし → Worker / redirect
   - DOM まで OK → JS / 依存 / 権限
   - 端末限定 → キャッシュ or 構文
4. HTML no-store + assets immutable を再確認
5. 再デプロイ → 実機確認

---

## 6. 学び（今回のポイント）
- 「白画面 = React の問題」とは限らない
- HTML が返っているかが最初の分岐点
- Boot beacon は実機デバッグの最短ルート

---

## 7. 関連変更（参考）
- Safari 互換 build target 設定
- Worker の SPA HTML 配信修正
- boot beacon（最大120文字エラー表示）

---

## ✅ ステータス
- Android Chrome: OK
- iPad Safari: OK
- 再発防止策: 実装済み
- 障害: クローズ 🎉
