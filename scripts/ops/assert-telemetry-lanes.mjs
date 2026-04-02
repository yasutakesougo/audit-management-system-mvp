/* eslint-disable no-console -- CI ops script */
/**
 * Assert Telemetry Lanes — CI Guard for SharePoint Lanes
 * 
 * このスクリプトは、Nightly telemetry の結果を解析し、
 * 特に read レーンの健全性が損なわれている場合に終了コード 1 を返して CI を落とします。
 * 
 * 判定基準:
 * 1. read レーンに失敗 (failed) が 1 件でもある場合
 * 2. read レーンの最大待ち時間 (maxQueuedMs) が閾値を超えた場合
 */

import fs from 'node:fs';
import path from 'node:path';

// --- Configuration ---

const SP_TELEMETRY_PATH = process.env.SP_TELEMETRY_PATH || '';
const READ_FAILED_THRESHOLD = Number(process.env.CI_READ_FAILED_THRESHOLD || '0');
const READ_QUEUE_THRESHOLD = Number(process.env.CI_READ_QUEUE_THRESHOLD || '1000');
const WRITE_FAILED_WARN_THRESHOLD = Number(process.env.CI_WRITE_FAILED_WARN_THRESHOLD || '0');
const CI_STRICT = process.env.CI_STRICT === 'true'; // If true, missing telemetry = fail

const ROOT = process.cwd();
const OUTPUT_JSON = path.join(ROOT, 'docs', 'nightly-patrol', 'lane-assertion-result.json');

// --- Execution ---

async function run() {
  console.log('🛡️  Asserting SharePoint telemetry lanes...');

  if (!SP_TELEMETRY_PATH) {
    const msg = '⚠️  SP_TELEMETRY_PATH is not set. Assertion skipped (Non-strict mode).';
    if (CI_STRICT) {
      console.error(`❌ FAILED: SP_TELEMETRY_PATH is required in strict mode.`);
      process.exit(1);
    }
    console.warn(msg);
    process.exit(0);
  }

  if (!fs.existsSync(SP_TELEMETRY_PATH)) {
    const msg = `⚠️  Telemetry file not found at: ${SP_TELEMETRY_PATH}. Assertion skipped.`;
    if (CI_STRICT) {
      console.error(`❌ FAILED: Telemetry file missing in strict mode: ${SP_TELEMETRY_PATH}`);
      process.exit(1);
    }
    console.warn(msg);
    process.exit(0);
  }

  let telemetry;
  try {
    telemetry = JSON.parse(fs.readFileSync(SP_TELEMETRY_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ Failed to parse telemetry JSON: ${error.message}`);
    process.exit(1);
  }

  const metrics = telemetry.metrics || telemetry.summary || {};
  const lanes = metrics.lanes || {};
  const readLane = lanes.read || { failed: 0, maxQueuedMs: 0, requests: 0 };
  const writeLane = lanes.write || { failed: 0, maxQueuedMs: 0, requests: 0 };
  const provLane = lanes.provisioning || { failed: 0, maxQueuedMs: 0, requests: 0 };

  const errors = [];
  const warnings = [];

  // 1. Read Lane Assertions (CRITICAL)
  if (readLane.failed > READ_FAILED_THRESHOLD) {
    errors.push(`[READ LANE] Failures detected: ${readLane.failed} (Threshold: ${READ_FAILED_THRESHOLD})`);
  }
  if (readLane.maxQueuedMs > READ_QUEUE_THRESHOLD) {
    errors.push(`[READ LANE] Queue timeout: ${readLane.maxQueuedMs}ms (Threshold: ${READ_QUEUE_THRESHOLD}ms)`);
  }

  // 2. Write Lane Assertions (WARNING)
  if (writeLane.failed > WRITE_FAILED_WARN_THRESHOLD) {
    warnings.push(`[WRITE LANE] Failures detected: ${writeLane.failed}`);
  }

  // 3. Provisioning Lane (INFO only for now)
  const provInfo = provLane.failed > 0 ? `[PROV LANE] Failures: ${provLane.failed} (Fail-Open active)` : null;

  // --- Output Results ---

  console.log('\n--- Lane Status ---');
  console.log(`🟢 Read:    ${readLane.requests} reqs, ${readLane.failed} fails, ${readLane.maxQueuedMs}ms max queue`);
  console.log(`🟡 Write:   ${writeLane.requests} reqs, ${writeLane.failed} fails, ${writeLane.maxQueuedMs}ms max queue`);
  console.log(`🛡️  Prov:    ${provLane.requests} reqs, ${provLane.failed} fails, ${provLane.maxQueuedMs}ms max queue`);
  console.log('-------------------\n');

  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (provInfo) {
    console.log(`ℹ️  Info: ${provInfo}`);
  }

  const result = {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    metrics: { read: readLane, write: writeLane, provisioning: provLane },
    thresholds: { readQueue: READ_QUEUE_THRESHOLD, readFailed: READ_FAILED_THRESHOLD },
    errors,
    warnings
  };

  // Ensure directory exists
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8');
  console.log(`📊 Result artifact saved to: ${path.relative(ROOT, OUTPUT_JSON)}`);

  if (errors.length > 0) {
    console.error('\n❌ CI ASSERTION FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nReason: Read lane health is critical for system stability. Direct cause must be investigated.');
    process.exit(1);
  }

  console.log('\n✅ Lane assertion passed.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
