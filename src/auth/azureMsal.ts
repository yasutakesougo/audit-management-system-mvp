export type { EventType } from '@azure/msal-browser';

type MsalBrowserExports = Pick<typeof import('@azure/msal-browser'), 'PublicClientApplication' | 'EventType'>;

export async function loadMsalBrowser(): Promise<MsalBrowserExports> {
	const { PublicClientApplication, EventType } = await import('@azure/msal-browser');

	return { PublicClientApplication, EventType } satisfies MsalBrowserExports;
}

