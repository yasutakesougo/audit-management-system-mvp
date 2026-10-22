// @node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { test } = process.env.VITEST ? await import('vitest') : await import('node:test');
const require = createRequire(import.meta.url);
const { load } = require('js-yaml');
// Immutable semantic snapshots of the authorized baseline; no Git history needed.
const legacy = {
  "test-csp.yml": {
    "events": {
      "push": {
        "branches": [
          "main"
        ]
      },
      "pull_request": null
    },
    "stepsSha256": "12e5e55e9136cd91c99c5be54ceec87c51f78fb4204312c07654cce14e92c415"
  },
  "fast-lane.yml": {
    "events": {
      "push": {
        "branches": [
          "port/flags",
          "main"
        ]
      },
      "pull_request": {
        "branches": [
          "main"
        ]
      }
    },
    "stepsSha256": "c482fdbee18c09fb6c983e19cd5dbc03236d0f27754c519fd99005b3a76c0ce9"
  },
  "label-schema-changes.yml": {
    "events": {
      "pull_request": {
        "types": [
          "opened",
          "synchronize",
          "reopened"
        ]
      }
    },
    "stepsSha256": "a4bc449f7a868e0e7b7811a38c5761081f8199bad5b46a45c86b2eddc2add678"
  },
  "storybook-a11y.yml": {
    "events": {
      "pull_request": null,
      "push": {
        "branches": [
          "main"
        ]
      }
    },
    "stepsSha256": "23ab2c3cd326c7ba853c1d7e5b08de9715a119f0231afc786d798d35dcac9bff"
  },
  "test-schedule.yml": {
    "events": {
      "push": null,
      "pull_request": null
    },
    "stepsSha256": "194bc8cc84a058cdcce093a945c9895387fa39a9635db5acb546511a1920b9ed"
  },
  "test.yml": {
    "events": {
      "push": {
        "branches": [
          "main"
        ]
      },
      "pull_request": {
        "branches": [
          "main",
          "develop"
        ],
        "types": [
          "opened",
          "synchronize",
          "reopened",
          "ready_for_review"
        ]
      },
      "workflow_dispatch": {
        "inputs": {
          "ref": {
            "description": "Target ref (branch or tag)",
            "required": false,
            "default": ""
          }
        }
      }
    },
    "stepsSha256": "b21294dde4213fe2f81556b304e87d5e7a253271ee4923cd5a6633d2111ad1dc"
  }
};
const specs = [
  ['test-csp.yml', 'csp'], ['fast-lane.yml', 'fast'],
  ['label-schema-changes.yml', 'label'], ['storybook-a11y.yml', 'sb-a11y'],
  ['test-schedule.yml', 'schedule'], ['test.yml', 'quality'],
];
const get = file => load(fs.readFileSync(`.github/workflows/${file}`, 'utf8'));
const hashSteps = steps => createHash('sha256').update(JSON.stringify(steps)).digest('hex');
const manualJob = (wf, name) => wf.jobs[`${name}-manual`] ?? wf.jobs[name];
const flags = {
  VITE_E2E_MSAL_MOCK: '1', VITE_SKIP_LOGIN: '1', VITE_SKIP_SHAREPOINT: '1',
  VITE_FORCE_SHAREPOINT: '0', VITE_DATA_PROVIDER: 'memory', VITE_DEMO_MODE: '1',
  VITE_FEATURE_SCHEDULES_SP: '0', VITE_FEATURE_SCHEDULES_GRAPH: '0',
};
for (const [file, name] of specs) {
  test(`${name}: manual dispatch and same-SHA checkout`, () => {
    const wf = get(file);
    assert.ok(Object.hasOwn(wf.on, 'workflow_dispatch'));
    const job = manualJob(wf, name);
    assert.equal(job.name ?? name, name);
    if (name !== 'label') {
      const checkout = job.steps.find(s => s.uses?.startsWith('actions/checkout@'));
      assert.equal(checkout.with.ref, '${{ github.sha }}');
    }
    assert.ok(!Object.hasOwn(wf.on.workflow_dispatch?.inputs ?? {}, 'ref'));
    assert.ok(!job['continue-on-error']);
  });
  test(`${name}: existing PR/push paths and validation commands are preserved`, () => {
    const wf = get(file), old = legacy[file];
    for (const event of ['push', 'pull_request']) assert.deepEqual(wf.on[event], old.events[event]);
    const steps = wf.jobs[name].steps.filter(s => !s.uses?.startsWith('actions/checkout@') && s.name !== 'Configure manual offline runtime');
    assert.equal(hashSteps(steps), old.stepsSha256, `${name}: existing validation steps changed`);
  });
  if (name !== 'label') test(`${name}: offline flags precede build/server/test and no credentials enter manual path`, () => {
    const job = manualJob(get(file), name);
    const configure = job.steps.findIndex(s => s.name === 'Configure manual offline runtime');
    assert.ok(configure >= 0);
    assert.ok(configure < job.steps.findIndex(s => /npm ci/.test(s.run ?? '')));
    const run = job.steps[configure].run;
    for (const [key, value] of Object.entries(flags)) assert.ok(run.includes(`${key}=${value}`), key);
    if (name === 'csp') assert.ok(run.includes('VITE_E2E=0'), 'do not skip CSP collector tests');
    assert.ok(run.includes('$GITHUB_ENV'));
    for (const step of job.steps) {
      assert.doesNotMatch(JSON.stringify(step), /secrets\.|vars\.|temporary-public-storage|create-act-warning-issue|scripts\/notify|ci:perf-report|run-perf-with-diagnostics/);
    }
  });
}
test('schedule: real SharePoint job cannot run on workflow_dispatch', () => {
  assert.equal(get('test-schedule.yml').jobs['e2e-schedules-sp-smoke'].if, "github.event_name != 'workflow_dispatch'");
});
test('quality: manual job runs required suites, browser checks and local performance assertions with read-only permissions', () => {
  const wf = get('test.yml'), job = manualJob(wf, 'quality');
  assert.equal(wf.jobs.quality.if, "github.event_name != 'workflow_dispatch'");
  assert.equal(job.if, "github.event_name == 'workflow_dispatch'");
  assert.deepEqual(job.permissions, { contents: 'read' });
  const runs = job.steps.map(s => s.run ?? '').join('\n');
  for (const cmd of ['npm run typecheck', 'npm run lint', 'npm run test:ci:required', 'basic-smoke.spec.ts', 'a11y-complex-page.spec.ts', 'npm run perf:build', '--config=lighthouserc.json', '--upload.target=filesystem', 'npm run perf:summary']) assert.ok(runs.includes(cmd), cmd);
  const required = job.steps.find(s => (s.run ?? '').includes('npm run test:ci:required'));
  assert.ok(!required.if, 'manual required suite must not retain PR-only condition');
});
const labelScript = () => get('label-schema-changes.yml').jobs['label-manual'].steps[0].with.script;
async function runLabel({ input = '2593', sha = 'abc', prSha = 'abc', prState = 'open', baseRef = 'main', files = [], labels = [] } = {}) {
  const failures = [];
  const pr = { head: { sha: prSha, repo: { full_name: 'owner/repo' } }, base: { ref: baseRef }, state: prState, labels: labels.map(name => ({ name })) };
  const github = { rest: { pulls: { get: async () => ({ data: pr }), listFiles: 'listFiles' } }, paginate: async () => files.map(filename => ({ filename })) };
  await vm.runInNewContext(`(async () => { ${labelScript()} })()`, {
    github, context: { repo: { owner: 'owner', repo: 'repo' }, sha },
    process: { env: { PR_NUMBER: input } },
    core: { setFailed: msg => failures.push(msg), info: () => {} },
  });
  return failures;
}
test('label: manual path is read-only and checks PR number, head SHA and schema label', async () => {
  const wf = get('label-schema-changes.yml');
  assert.equal(wf.jobs.label.if, "github.event_name != 'workflow_dispatch'");
  assert.equal(wf.jobs['label-manual'].name, 'label');
  assert.deepEqual(wf.jobs['label-manual'].permissions, { contents: 'read', 'pull-requests': 'read' });
  assert.deepEqual(await runLabel(), []);
  assert.equal((await runLabel({ input: '1; injected' })).length, 1);
  assert.equal((await runLabel({ prSha: 'wrong' })).length, 1);
  assert.equal((await runLabel({ prState: 'closed' })).length, 1);
  assert.equal((await runLabel({ baseRef: 'develop' })).length, 1);
  assert.equal((await runLabel({ files: ['provision/lists.json'] })).length, 1);
  assert.equal((await runLabel({ files: ['docs/list.schema.json'] })).length, 1);
  assert.deepEqual(await runLabel({ files: ['provision/lists.json'], labels: ['schema'] }), []);
  assert.doesNotMatch(labelScript(), /createLabel|addLabels|issues\./);
});
test('quality: local performance failure codes cannot be masked by summary success', () => {
  const perf = manualJob(get('test.yml'), 'quality').steps.find(s => s.name === 'Manual performance gate (filesystem only)').run;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-perf-'));
  try {
    fs.writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\ncase "$*" in *perf:build*) exit "${BUILD_CODE:-0}";; *perf:summary*) exit "${SUMMARY_CODE:-0}";; esac\n');
    fs.writeFileSync(path.join(dir, 'npx'), '#!/bin/sh\nexit "${LH_CODE:-0}"\n');
    for (const bin of ['npm','npx']) fs.chmodSync(path.join(dir, bin), 0o755);
    for (const [build, lh, summary, expected] of [[0,0,0,0],[4,0,0,4],[0,5,0,5],[0,0,6,6],[0,5,6,5]]) {
      const result = spawnSync('bash', ['-c', perf], { cwd: dir, env: { PATH: `${dir}:${process.env.PATH}`, BUILD_CODE: `${build}`, LH_CODE: `${lh}`, SUMMARY_CODE: `${summary}` } });
      assert.equal(result.status, expected, result.stderr?.toString());
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('manual required check names cannot collide with skipped legacy jobs', () => {
  for (const [file, name] of [['test.yml', 'quality'], ['label-schema-changes.yml', 'label']]) {
    const job = get(file).jobs[name];
    assert.ok(job.name.includes("github.event_name == 'workflow_dispatch'"));
    assert.ok(job.name.includes(`|| '${name}'`));
    assert.ok(job.name.includes(`${name} (`));
  }
});

test('quality: audit reports failure even if the three test steps passed but lint or perf failed', () => {
  const step = manualJob(get('test.yml'), 'quality').steps.find(s => s.name === 'Classify quality job completion');
  const script = step.run.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    if (key.trim() === 'job.status') return 'failure';
    if (key.includes('.outcome')) return 'success';
    return 'test';
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-audit-'));
  try {
    const result = spawnSync('bash', ['-c', script], { cwd: dir, env: { PATH: process.env.PATH, GITHUB_STEP_SUMMARY: path.join(dir, 'summary') } });
    assert.equal(result.status, 0, result.stderr?.toString());
    const audit = JSON.parse(fs.readFileSync(path.join(dir, 'quality-cancel-audit.json'), 'utf8'));
    assert.equal(audit.classification, 'quality_failed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
