/**
 * SupportPlanGuide — PDF印刷プレビュー
 *
 * openPrintView() を SupportPlanGuidePage.tsx から抽出。
 *
 * Phase 5: form.goals (GoalItem[]) のみを出力ソースとする。
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanForm } from '../types';
import { formatDateJP } from './helpers';

// ── Goal → HTML 変換ヘルパー ──

/** GoalItem[] を type でフィルタし、HTML <ul><li> を構築する */
function goalsToHtml(
  goals: GoalItem[] | undefined,
  type: GoalItem['type'],
  esc: (s: string) => string,
): string {
  const filtered = goals?.filter((g) => g.type === type) ?? [];
  if (filtered.length === 0) return '';
  const items = filtered
    .map((g) => {
      const label = g.label?.trim() ? `<strong>${esc(g.label.trim())}</strong>: ` : '';
      const text = esc(g.text?.trim() ?? '').replace(/\n/g, '<br/>');
      return `<li>${label}${text}</li>`;
    })
    .join('');
  return `<ul style="margin:2pt 0;padding-left:16pt;">${items}</ul>`;
}

// PDFプレビュー/印刷（表組み・ロゴ・ページ番号・押印枠 + 事業所情報 + セクション見出し）
export function openPrintView(data: SupportPlanForm, title: string) {
  // SSR/テスト環境での安全性確保
  if (typeof window === 'undefined') return;

  // HTMLエスケープ
  const esc = (s: string) =>
    String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

  // 1行（空はスキップ）
  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr><th>${esc(label)}</th><td>${esc(value).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  // 1行（HTMLを直接渡すバージョン — goal用）
  const rowHtml = (label: string, html: string) =>
    html && html.trim()
      ? `<tr><th>${esc(label)}</th><td>${html}</td></tr>`
      : '';

  // セクション見出し＋中身（空なら非表示）
  const section = (titleText: string, inner: string) =>
    inner && inner.trim()
      ? `<tr class="section"><th colspan="2">${esc(titleText)}</th></tr>${inner}`
      : '';

  // 事業所情報（window から一時上書き可）
  const org = {
    name: window.__ORG_NAME__ ?? '磯子区障害者地域活動ホーム',
    address: window.__ORG_ADDRESS__ ?? '〒000-0000 神奈川県横浜市磯子区○○○○',
    tel: window.__ORG_TEL__ ?? 'TEL 045-000-0000',
    fax: window.__ORG_FAX__ ?? 'FAX 045-000-0001',
  };

  // ── 目標セクション: goals のみ ──
  const longGoalsHtml = goalsToHtml(data.goals, 'long', esc);
  const shortGoalsHtml = goalsToHtml(data.goals, 'short', esc);
  const supportGoalsHtml = goalsToHtml(data.goals, 'support', esc);

  const secGoals =
    rowHtml('長期目標（6か月以上）', longGoalsHtml) +
    rowHtml('短期目標（3か月目安）', shortGoalsHtml);

  const secSupports = rowHtml('支援内容', supportGoalsHtml);

  // 各セクションの行を構築
  const secBasic =
    row('利用者名 / ID', data.serviceUserName) +
    row('支援区分・医療リスク等', data.supportLevel) +
    row('計画期間', data.planPeriod);

  const secAssessment =
    row('ニーズ・課題の要約', data.assessmentSummary) +
    row('強み・活用資源', data.strengths);

  const secDecision =
    row('意思決定支援の工夫', data.decisionSupport) +
    row('サービス担当者会議・同意の記録', data.conferenceNotes);

  const secMonitoring =
    row('モニタリング手法', data.monitoringPlan) +
    row('見直しタイミング・判断基準', data.reviewTiming) +
    row('直近モニタ実施日', data.lastMonitoringDate);

  const secRisk =
    row('主なリスクと対応策', data.riskManagement) +
    row('証跡・ダブルチェック手順', data.complianceControls);

  const secExcellence =
    row('改善提案 / 次のアクション', data.improvementIdeas);

  // 表（30%/70%）
  const table = `
    <table class="kv">
      ${section('基本情報', secBasic)}
      ${section('アセスメント', secAssessment)}
      ${section('目標（SMART）', secGoals)}
      ${section('具体的支援', secSupports)}
      ${section('意思決定支援・会議記録', secDecision)}
      ${section('モニタリングと見直し', secMonitoring)}
      ${section('減算リスク対策', secRisk)}
      ${section('卓越性・改善提案', secExcellence)}
    </table>
  `;

  // 完成HTML（ここで定義してから window へ書き込む）
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', 'YuGothic', Meiryo, sans-serif; font-size: 12pt; color: #111; counter-reset: page; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12pt; margin-bottom: 8pt; }
  .h-left { display: flex; align-items: center; gap: 10pt; }
  header img.logo { height: 28pt; }
  header .title { font-size: 18pt; font-weight: 700; }
  .org { text-align: right; line-height: 1.4; }
  .org .name { font-weight: 600; }
  .org .meta { font-size: 10pt; color: #555; }
  .meta { color: #555; font-size: 10pt; margin-bottom: 10pt; }
  h2 { font-size: 13pt; margin: 14pt 0 8pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
  table.kv { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.kv th, table.kv td { border: 1px solid #bbb; vertical-align: top; padding: 6pt 8pt; word-break: break-word; }
  table.kv th { background: #f8f9fa; width: 30%; font-size: 10.5pt; }
  table.kv td { width: 70%; font-size: 10pt; line-height: 1.6; }
  table.kv td ul { margin: 2pt 0; padding-left: 16pt; }
  table.kv td li { margin-bottom: 4pt; }
  tr.section th { background: #E8F0E4; font-weight: 700; text-align: center; font-size: 11pt; color: #3D6B3C; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin: 20pt 0; }
  .signatures .box { border: 1px solid #999; min-height: 40pt; position: relative; padding: 6pt; }
  .signatures .box h3 { font-size: 10pt; margin: 0; }
  .signatures .box .stamp { position: absolute; right: 6pt; bottom: 6pt; font-size: 9pt; color: #666; }
  footer { position: fixed; bottom: 8mm; left: 16mm; right: 16mm; display: flex; justify-content: space-between; font-size: 8pt; color: #666; }
  footer .pageno::before { content: counter(page); }
</style>
</head>
<body>
  <header>
    <div class="h-left">
      <img class="logo" src="/logo.png" alt="logo" />
      <div class="title">個別支援計画書（生活介護）</div>
    </div>
    <div class="org">
      <div class="name">${esc(org.name)}</div>
      <div class="meta">${esc(org.address)}<br/>${esc(org.tel)} ／ ${esc(org.fax)}</div>
    </div>
  </header>
  <div class="meta">対象: ${esc(title)} ／ 作成日: ${formatDateJP(new Date())}</div>
  ${table}
  <h2>署名・職印欄</h2>
  <div class="signatures">
    <div class="box"><h3>本人</h3></div>
    <div class="box"><h3>家族／代理人</h3></div>
    <div class="box"><h3>サービス管理責任者</h3><span class="stamp">職印</span></div>
    <div class="box"><h3>事業所 管理者</h3><span class="stamp">職印</span></div>
  </div>
  <footer>
    <div>© ${new Date().getFullYear()} 事業所</div>
    <div>Page <span class="pageno"></span></div>
  </footer>
</body>
</html>`;

  // 印刷ウィンドウを開いて書き込み
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  const timer = setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* noop */ }
  }, 500);
  win.addEventListener('beforeunload', () => clearTimeout(timer));
}
