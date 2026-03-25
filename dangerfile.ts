import { danger, warn } from 'danger';

/**
 * ======================================================================
 * ADR-002-B: Today Execution Layer Guardrails (Danger.js)
 * ======================================================================
 * 目的: "自動ブロック(fail)"ではなく、設計思想の"再通知(warn)"を行う。
 * 開発者が意図せず Today を Decision Layer (ダッシュボード) に戻してしまう
 * ような「违和感のあるPR」に、ADR文脈付きで素早くフィードバックを与える。
 */

const ADR_LINK = 'docs/adr/ADR-002-B-today-bento-layout-guardrails.md';
const ADR_REF = `(👉 詳しくは [ADR-002-B](${ADR_LINK}) を参照)`;

const modifiedTodayFiles = danger.git.modified_files.filter((f) => f.includes('src/features/today/'));
const addedTodayFiles = danger.git.created_files.filter((f) => f.includes('src/features/today/'));
const allTodayChanges = [...modifiedTodayFiles, ...addedTodayFiles];

if (allTodayChanges.length > 0) {
  // ----------------------------------------------------------------------
  // 1. [Rule: hero-bloat] Heroの肥大化・複数CTA化の警告
  // ----------------------------------------------------------------------
  const heroCardFile = allTodayChanges.find((f) => f.includes('HeroActionCard.tsx'));
  
  if (heroCardFile) {
    danger.git.diffForFile(heroCardFile).then((diff) => {
      if (!diff) return;
      
      const addedLines = diff.added;
      const buttonMatches = addedLines.match(/<Button/g) || [];
      const actionMatches = addedLines.match(/Action/g) || [];
      
      if (buttonMatches.length > 1 || actionMatches.length > 3) {
        // eslint-disable-next-line no-console
        console.log('[DANGER_RULE] hero-bloat');
        warn(
          `💡 **[Rule: hero-bloat] \`HeroActionCard\` コスト増加の可能性**<br/>` +
          `Heroは開始後5秒で「今やるべき最優先の1件」のみを提示する空間（Single-threaded entry point）です。` +
          `複数のCTAやついで情報を足すと、迷いが生じアクションが遅れます。最優先を1つに絞り込めているか見直してみてください。 ${ADR_REF}`
        );
      }
    });
  }

  // ----------------------------------------------------------------------
  // 2. [Rule: progress-passive] ProgressRings 非ナビゲーション化の警告
  // ----------------------------------------------------------------------
  const progressRingsFile = allTodayChanges.find((f) => f.includes('ProgressRings.tsx'));
  
  if (progressRingsFile) {
    danger.git.diffForFile(progressRingsFile).then((diff) => {
      if (!diff) return;
      
      const addedLines = diff.added;
      const hasMetric = addedLines.includes('progress:') || addedLines.includes('value:');
      const hasOnClick = addedLines.includes('onClick');
      const hasHref = addedLines.includes('href');
      
      if (hasMetric && !hasOnClick && !hasHref) {
        // eslint-disable-next-line no-console
        console.log('[DANGER_RULE] progress-passive');
        warn(
          `💡 **[Rule: progress-passive] \`ProgressRings\` 導線漏れの可能性**<br/>` +
          `指標の追加ありがとうございます。Progressは「見るための数字(Dashboard)」ではなく、` +
          `「次の処理へ進むための導線(Execution Layer)」である必要があります。可能であれば、対象一覧や詳細画面への遷移（onClick等）をセットにしてください。 ${ADR_REF}`
        );
      }
    });
  }

  // ----------------------------------------------------------------------
  // 3. [Rule: c1-bloat] C1（常時表示領域）の無闇な追加・飽和警告
  // ----------------------------------------------------------------------
  const bentoLayoutFile = allTodayChanges.find((f) => f.includes('TodayBentoLayout.tsx'));
  
  if (bentoLayoutFile) {
    danger.git.diffForFile(bentoLayoutFile).then((diff) => {
      if (!diff) return;
      
      const addedLines = diff.added;
      const addedCards = (addedLines.match(/<BentoCard/g) || []).length;
      
      if (addedCards > 0) {
        // eslint-disable-next-line no-console
        console.log('[DANGER_RULE] c1-bloat');
        warn(
          `🔍 **[Rule: c1-bloat] \`TodayBentoLayout\` へのコンポーネント追加(${addedCards}件)を検知しました**<br/>` +
          `これが常時表示されるもの（C1領域）の場合、今日の実务に**必須かつ高頻度で触るか**を再確認してください。` +
          `運用上必要だが常時見なくてもよい管理・参照情報は、デフォルト閉の折りたたみ（C2領域）に逃がすと画面のノイズが防げます。 ${ADR_REF}`
        );
      }
    });
  }
}
