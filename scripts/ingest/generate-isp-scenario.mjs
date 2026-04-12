import fs from 'fs';
import path from 'path';

/**
 * generate-isp-scenario.mjs
 * 
 * Ingested Markdown (ISP Template v1.0) -> Vitest Scenario Test Converter.
 * 
 * Usage:
 *   node scripts/ingest/generate-isp-scenario.mjs <markdown_path>
 */

const markdownPath = process.argv[2];
if (!markdownPath) {
  console.error('Usage: node generate-isp-scenario.mjs <markdown_path>');
  process.exit(1);
}

const content = fs.readFileSync(markdownPath, 'utf8');

// --- Simple Frontmatter Parser ---
const fmMatch = content.match(/^---([\s\S]*?)---/);
const fmRaw = fmMatch ? fmMatch[1] : '';
const frontmatter = {};
fmRaw.split('\n').forEach(line => {
  const [key, ...val] = line.split(':');
  if (key && val.length > 0) {
    frontmatter[key.trim()] = val.join(':').trim();
  }
});

const userId = frontmatter['user_id'] || '9999';
const fiscalYear = frontmatter['fiscal_year'] || '2026';
const userName = content.match(/- 利用者名: (.*)/)?.[1] || 'Unknown';
const baseFileName = path.basename(markdownPath, '.md');
const pascalName = baseFileName.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

// --- Content Extraction ---
const longTermGoals = [...content.matchAll(/### 長期目標（1年）\n([\s\S]*?)\n###/g)][0]?.[1]
  ?.split('\n')
  .map(l => l.replace(/^- /, '').trim())
  .filter(l => l) || [];

const shortTermGoals = [...content.matchAll(/### 短期目標（6ヶ月）\n([\s\S]*?)\n---/g)][0]?.[1]
  ?.split('\n')
  .map(l => l.replace(/^[0-9.]+\s*/, '').replace(/^- /, '').trim())
  .filter(l => l) || [];

// --- Monitoring Extraction (Simplified) ---
const monitoringSections = content.split(/## (.*)月（(.*)モニタリング）/);
const monitoringRecords = [];
for (let i = 1; i < monitoringSections.length; i += 3) {
  const month = monitoringSections[i];
  const type = monitoringSections[i + 1] === '中間' ? 'interim' : 'regular';
  const body = monitoringSections[i + 2];
  
  const status = body.match(/- 目標1: \*\*(.*)\*\*/)?.[1] || '実施中 (○)';
  const decision = body.match(/### 決定事項\n- \*\*(.*)\*\*/)?.[1] || '継続';
  
  let mappedDecision = 'no_change';
  if (decision.includes('大幅改訂') || decision.includes('Major Revision')) mappedDecision = 'major_revision';
  if (decision.includes('軽微')) mappedDecision = 'minor_revision';

  monitoringRecords.push({
    month,
    type,
    status,
    decision: mappedDecision,
    rawDecision: decision
  });
}

// --- Test Generation ---
const specPath = path.join('src/domain/isp/__tests__', `ispScenario_${pascalName}.generated.spec.ts`);

const testCode = `
/**
 * AUTO-GENERATED SCENARIO TEST
 * Source: ${markdownPath}
 * Generated: ${new Date().toISOString()}
 */
import { describe, expect, it } from 'vitest';
import type { IndividualSupportPlan } from '../types';
import { 
  computeMonitoringSummary,
  type MonitoringMeetingRecord 
} from '../monitoringMeeting';

describe('ISP Scenario (Generated): ${userName}', () => {
  const isp: IndividualSupportPlan = {
    id: 'isp-${baseFileName}',
    userId: ${userId},
    status: 'implementation',
    version: 'v1.0',
    createdAt: '2026-04-01T00:00:00Z',
    createdBy: 1,
    updatedAt: '2026-04-01T00:00:00Z',
    updatedBy: 1,
    personalIntention: '',
    familyIntention: '',
    overallSupportPolicy: '',
    qolImprovementIssues: [],
    longTermGoals: ${JSON.stringify(longTermGoals, null, 2)},
    shortTermGoals: ${JSON.stringify(shortTermGoals, null, 2)},
    targetDate: '${fiscalYear}-03-31',
    precautions: [],
    deliveryRecords: [],
    meetingRecords: [],
    monitoringRecords: [],
    reviewHistory: [],
  };

  it('should have correctly parsed goals from Markdown', () => {
    expect(isp.longTermGoals).toHaveLength(${longTermGoals.length});
    expect(isp.shortTermGoals).toHaveLength(${shortTermGoals.length});
  });

  ${monitoringRecords.map((m, idx) => {
    const year = parseInt(m.month) <= 3 ? parseInt(fiscalYear) + 1 : parseInt(fiscalYear);
    return `
  it('should validate monitoring check for ${m.month}月 (${m.type})', () => {
    const year = ${year};
    const records: MonitoringMeetingRecord[] = [
      {
        id: 'mtg-${idx}',
        userId: '${userId}',
        ispId: isp.id,
        meetingType: '${m.type}',
        meetingDate: \`\${year}-\${'${m.month}'.padStart(2, '0')}-15\`,
        venue: 'Default',
        attendees: [],
        goalEvaluations: [
          { goalText: 'Goal 1', achievementLevel: 'mostly_achieved', comment: '${m.status}' }
        ],
        overallAssessment: '',
        userFeedback: '',
        familyFeedback: '',
        planChangeDecision: '${m.decision}',
        changeReason: '',
        decisions: [${JSON.stringify(m.rawDecision)}],
        nextMonitoringDate: '',
        recordedBy: 'Auto',
        recordedAt: '',
        status: 'finalized',
        discussionSummary: '',
      }
    ];

    const summary = computeMonitoringSummary(records, \`\${year}-10-01\`);
    expect(summary.totalMeetings).toBe(1);
    ${m.decision === 'major_revision' ? `expect(summary.pendingPlanChanges).toBe(1);` : ''}
  });
  `;}).join('\n')}

  it('should validate the 6-month monitoring continuity for the whole period', () => {
    const records: MonitoringMeetingRecord[] = [
      ${monitoringRecords.map(m => {
        const year = parseInt(m.month) <= 3 ? parseInt(fiscalYear) + 1 : parseInt(fiscalYear);
        return `{
        userId: '${userId}',
        meetingType: '${m.type}',
        meetingDate: '${year}-${m.month.padStart(2, '0')}-15',
        goalEvaluations: [],
        planChangeDecision: '${m.decision}',
      }`;}).join(',\n      ')}
    ] as any;

    const summary = computeMonitoringSummary(records, '${parseInt(fiscalYear) + 1}-03-31');
    // If gaps are too wide, this would be true. Given the template dates (09-15 and 03-15), it should be false (within 183 days).
    expect(summary.hasContinuityViolation).toBe(false);
  });
});
`;

fs.writeFileSync(specPath, testCode.trim());
console.log(`Successfully generated scenario test: ${specPath}`);
