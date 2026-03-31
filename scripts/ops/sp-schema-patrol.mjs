import fs from 'fs';

/**
 * SharePoint Schema Patrol
 * 
 * ログファイルから [sp:schema_mismatch] ログを抽出し、
 * スキーマの乖離を報告する。乖離がある場合は非ゼロの終了コードを返す。
 */

/* eslint-disable no-console, no-restricted-globals */
const LOG_FILE = process.env.LOG_FILE || './logs/today.auto.log';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
async function run() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`✅ Log file not found: ${LOG_FILE}. Assuming clean environment.`);
    process.exit(0);
  }

  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  // 直近1日分などのフィルタリングが必要な場合はここで日付チェックを入れる
  const matches = [...content.matchAll(/\[sp:schema_mismatch\]\s*(\{.*\})/g)];

  if (matches.length === 0) {
    console.log('✅ No schema mismatch detected in logs.');
    process.exit(0);
  }

  const results = matches.map(m => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return { raw: m[1], error: 'Parse failed' };
    }
  });

  // 重複排除 (List名 + MissingFields の組み合わせ)
  const uniqueIssues = new Map();
  results.forEach(r => {
    const key = `${r.listName}:${(r.missingFields || []).join(',')}`;
    uniqueIssues.set(key, r);
  });

  const issues = Array.from(uniqueIssues.values());

  console.log(`⚠️  ${issues.length} Schema mismatch(es) detected:`);
  
  let reportText = `🚨 *SharePoint Schema Mismatch Detected*\n\n`;
  issues.forEach(r => {
    const missing = (r.missingFields || []).join(', ');
    const line = `- *${r.listName}* (${r.key}): Missing fields [ ${missing} ]`;
    console.log(line);
    reportText += `${line}\n`;
  });

  if (SLACK_WEBHOOK_URL) {
    console.log('Sending report to Slack...');
    // eslint-disable-next-line no-undef
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: reportText,
        username: 'SP Schema Patrol',
        icon_emoji: ':warning:'
      })
    });
  }

  // エラーとして終了（CI/CDで検知可能にする）
  process.exit(1);
}

run().catch(err => {
  console.error('Patrol failed:', err);
  process.exit(1);
});
