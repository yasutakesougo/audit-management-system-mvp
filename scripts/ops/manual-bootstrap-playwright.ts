/* eslint-disable no-console */
import { chromium } from '@playwright/test';
import { SharePointProvisioningCoordinator } from '../../src/sharepoint/spProvisioningCoordinator';
import { createNormalizePath } from '../../src/lib/sp/spFetch';
import { createListOperations } from '../../src/lib/sp/spLists';
import * as fs from 'fs';
import * as path from 'path';

/**
 * manual-bootstrap-playwright.ts
 * 
 * auth:setup で保存された storageState.json を使用して
 * SharePoint のプロビジョニングを実行する。
 */
async function main() {
  const siteUrl = process.env.SHAREPOINT_SITE || 'https://isogokatudouhome.sharepoint.com/sites/welfare';
  const STORAGE_STATE_PATH = path.join(process.cwd(), 'tests/.auth/storageState.json');
  
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    console.error(`❌ storageState.json not found. Run 'npm run auth:setup' first.`);
    process.exit(1);
  }

  console.log(`🚀 Starting Bootstrap via Playwright Session...`);
  console.log(`📡 Site: ${siteUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const request = context.request;

  // ── SpClient の構成 ──

  // 1. spFetch の実装（Playwright のセッションを使用）
  const spFetch = async (url: string, init: any = {}) => {
    // 内部パスの場合はフルURLに変換（createListOperations が内部でやるはずだが念のため）
    const fullUrl = url.startsWith('http') ? url : `${siteUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    
    const headers = {
      'Accept': 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': 'dummy', // 後で必要なら取得するが、GETには不要。POSTには __metadata 等が必要な場合あり。
      ...init.headers,
    };

    // FormDigest の取得（POST/PATCH/DELETE のために必要）
    if (init.method && init.method !== 'GET') {
      const digestRes = await request.post(`${siteUrl}/_api/contextinfo`, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      if (digestRes.ok()) {
        const digestJson = await digestRes.json();
        headers['X-RequestDigest'] = digestJson.d.GetContextWebInformation.FormDigestValue;
      }
    }

    const response = await request.fetch(fullUrl, {
      data: init.body,
      headers: headers as any,
      method: init.method || 'GET',
    });

    // Node-fetch 互換のレスポンスオブジェクトに変換
    return {
      ok: () => response.ok(),
      status: response.status(),
      statusText: response.statusText(),
      json: () => response.json(),
      text: () => response.text(),
      headers: {
        get: (name: string) => response.headers()[name.toLowerCase()],
      },
    } as any;
  };

  // 2. 他のユーティリティ
  const envRecord = {
    VITE_SP_RESOURCE: 'https://isogokatudouhome.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/welfare',
  } as any;
  const normalizePath = createNormalizePath(envRecord, '', `${siteUrl}/_api/web`);
  
  // 3. ListOperations の作成
  const listOps = createListOperations(spFetch, normalizePath, `${siteUrl}/_api/web`);

  const spClient = {
    spFetch,
    ...listOps,
  } as any;

  try {
    const result = await SharePointProvisioningCoordinator.bootstrap(spClient, { force: true });

    console.log('\n✅ Provisioning Completed via Session');
    console.log(`   Total:   ${result.total}`);
    console.log(`   Healthy: ${result.healthy}`);
    console.log(`   Unhealthy: ${result.unhealthy}`);

    console.log('\n--- Summaries ---');
    result.summaries.forEach(s => {
      const icon = s.status === 'ok' || s.status === 'provisioned' ? '✅' : s.status === 'drifted' ? '🟡' : '❌';
      console.log(`${icon} [${s.status}] ${s.listKey} (${s.listName}) ${s.details || ''}`);
    });

  } catch (err) {
    console.error('❌ Provisioning failed:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
