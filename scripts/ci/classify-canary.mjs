import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTH_SIGNAL_PATTERNS = [
  /\bAUTH_REQUIRED\b/i,
  /SharePoint Authentication Failed/i,
  /\b(?:401|403)\b/,
  /\bPW_STORAGE_STATE_B64\b/i,
  /\bstorageState\b/i,
  /\bstorage state\b/i,
];

const toExitCode = (value) => {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasAuthSignal = (logText) => AUTH_SIGNAL_PATTERNS.some((pattern) => pattern.test(logText ?? ''));

const LHCI_SERVER_PATTERNS = [/startServer/i, /ECONNREFUSED/i, /timed out waiting for.*server/i];
const LHCI_CHROME_PATTERNS = [/CHROME_INTERSTITIAL_ERROR/i, /Chrome.*(?:failed|error|crash)/i, /Unable to connect to Chrome/i, /PROTOCOL_TIMEOUT/i];
const LHCI_BUDGET_PATTERNS = [/assertion failed/i, /categories:performance/i, /largest-contentful-paint/i, /cumulative-layout-shift/i];

export function classifyCanaryResult({ e2eExitCode = 0, lhciExitCode = 0, summaryExitCode = 0, e2eLog = '', lhciLog = '' } = {}) {
  const e2e = toExitCode(e2eExitCode);
  const lhci = toExitCode(lhciExitCode);
  const summary = toExitCode(summaryExitCode);

  if (e2e !== 0) {
    if (hasAuthSignal(e2eLog)) {
      return {
        classification: 'canary_auth_required',
        failedStage: 'e2e',
        reason: 'E2E failed with an authentication-related signal.',
        exitCode: e2e,
      };
    }
    return {
      classification: 'canary_ui_failure',
      failedStage: 'e2e',
      reason: 'E2E failed without an authentication-related signal.',
      exitCode: e2e,
    };
  }

  if (lhci !== 0) {
    if (LHCI_SERVER_PATTERNS.some((pattern) => pattern.test(lhciLog))) {
      return { classification: 'canary_lhci_server_failure', failedStage: 'lhci', reason: 'LHCI could not reach a healthy preview server.', exitCode: lhci };
    }
    if (LHCI_CHROME_PATTERNS.some((pattern) => pattern.test(lhciLog))) {
      return { classification: 'canary_lhci_chrome_failure', failedStage: 'lhci', reason: 'LHCI failed while starting or controlling Chrome.', exitCode: lhci };
    }
    if (LHCI_BUDGET_PATTERNS.some((pattern) => pattern.test(lhciLog))) {
      return { classification: 'canary_lhci_budget_failure', failedStage: 'lhci', reason: 'LHCI completed collection but failed a performance assertion.', exitCode: lhci };
    }
    return {
      classification: 'canary_lhci_failure',
      failedStage: 'lhci',
      reason: 'LHCI failed after E2E completed.',
      exitCode: lhci,
    };
  }

  if (summary !== 0) {
    return {
      classification: 'canary_summary_failure',
      failedStage: 'summary',
      reason: 'Performance summary generation failed after E2E and LHCI completed.',
      exitCode: summary,
    };
  }

  return {
    classification: 'canary_pass',
    failedStage: 'none',
    reason: 'Canary completed without failure.',
    exitCode: 0,
  };
}

const readTextSafe = (filePath) => {
  if (!filePath) return '';
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const appendGithubOutput = (entries) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
};

const appendStepSummary = (markdown) => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${markdown}\n`);
};

const renderMarkdown = (result, inputs) => `# Quality Gates Canary Classification

- classification: **${result.classification}**
- failedStage: **${result.failedStage}**
- reason: ${result.reason}
- exitCode: **${result.exitCode}**
- e2eExitCode: ${inputs.e2eExitCode}
- lhciExitCode: ${inputs.lhciExitCode}
- summaryExitCode: ${inputs.summaryExitCode}
`;

async function main() {
  const outDir = process.env.CANARY_CLASSIFICATION_DIR || 'reports/quality-gates';
  const e2eLogPath = process.env.CANARY_E2E_LOG_PATH || path.join(outDir, 'canary-e2e.log');
  const inputs = {
    e2eExitCode: toExitCode(process.env.CANARY_E2E_EXIT_CODE),
    lhciExitCode: toExitCode(process.env.CANARY_LHCI_EXIT_CODE),
    summaryExitCode: toExitCode(process.env.CANARY_SUMMARY_EXIT_CODE),
  };
  const result = classifyCanaryResult({
    ...inputs,
    e2eLog: readTextSafe(e2eLogPath),
    lhciLog: readTextSafe(lhciLogPath),
  });

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'canary-classification.json');
  const mdPath = path.join(outDir, 'canary-classification.md');
  const payload = {
    ...result,
    ...inputs,
    e2eLogPath,
    generatedAt: new Date().toISOString(),
  };
  const markdown = renderMarkdown(result, inputs);

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  appendGithubOutput({
    classification: result.classification,
    failed_stage: result.failedStage,
    exit_code: result.exitCode,
    should_fail: result.classification === 'canary_pass' ? 'false' : 'true',
  });
  appendStepSummary(markdown);

  console.log(markdown);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error('[classify-canary] failed unexpectedly');
    console.error(error);
    process.exit(1);
  });
}
