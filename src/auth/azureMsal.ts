export type { EventType } from '@azure/msal-browser';

import type { PublicClientApplication } from '@azure/msal-browser';
import { getRuntimeEnv } from '@/env';
import { msalConfig } from './msalConfig';

type MsalBrowserExports = Pick<typeof import('@azure/msal-browser'), 'PublicClientApplication' | 'EventType'>;
type MsalGlobalCarrier = typeof globalThis & { __MSAL_PUBLIC_CLIENT__?: PublicClientApplication };
type MsalBrowserConfiguration = ConstructorParameters<typeof PublicClientApplication>[0];

export async function loadMsalBrowser(): Promise<MsalBrowserExports> {
	const { PublicClientApplication, EventType } = await import('@azure/msal-browser');

	return { PublicClientApplication, EventType } satisfies MsalBrowserExports;
}

// 🔥 CRITICAL: Singleton PCA instance (provider-agnostic, used by main.tsx for redirect handling)
let pcaInstance: PublicClientApplication | null = null;

// dev/test only: PCA生成回数の監視（二重初期化検出）
let __pcaCreateCount = 0;
export const __getPcaCreateCount = () => __pcaCreateCount;

export const getPcaSingleton = async (): Promise<PublicClientApplication> => {
	if (pcaInstance) {
		return pcaInstance;
	}

	if (typeof window === 'undefined') {
		throw new Error('[msal] getPcaSingleton only available in browser runtime');
	}

	// Ensure runtime env is loaded (app config respects env.runtime.json overrides)
	await getRuntimeEnv();

	const { PublicClientApplication } = await loadMsalBrowser();

	// 🔍 msalConfig already includes runtime env overrides via getAppConfig()
	const config: MsalBrowserConfiguration = msalConfig as unknown as MsalBrowserConfiguration;

	// 🔍 Track PCA creation count (detect duplicate initialization)
	__pcaCreateCount += 1;

	// dev/testでは検出を強める（CIで拾える）
	const isTest = import.meta.env.MODE === 'test';
	const isDev = import.meta.env.DEV;

	if ((isDev || isTest) && __pcaCreateCount > 1) {
		const errorMsg = `[MSAL] Duplicate PCA creation detected: ${__pcaCreateCount} instances created`;
		console.error(errorMsg);
		if (isTest) {
			// ユニットテストで落とせるように
			throw new Error(errorMsg);
		}
	}

	pcaInstance = new PublicClientApplication(config);

	// Cache in globalThis for use by MsalProvider + other consumers
	(globalThis as MsalGlobalCarrier).__MSAL_PUBLIC_CLIENT__ = pcaInstance;

	console.info('[msal] singleton instance created and cached');
	return pcaInstance;
};

export const getPcaOrNull = (): PublicClientApplication | null => {
	return pcaInstance || (globalThis as MsalGlobalCarrier).__MSAL_PUBLIC_CLIENT__ || null;
};

