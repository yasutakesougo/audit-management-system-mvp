import '@formatjs/intl-datetimeformat/add-all-tz';
import '@formatjs/intl-datetimeformat/polyfill';
import '@formatjs/intl-getcanonicallocales';
// Apply React Router v7 future flags globally across tests
import './tests/setup/router-future-flags';
// Vitest global setup: polyfill crypto.randomUUID if absent (Node < 19 environments)
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'crypto';
import React from 'react';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, expect, vi } from 'vitest';

process.env.TZ ??= 'Asia/Tokyo';
// Provide safe defaults for MSAL-dependent modules during unit tests
process.env.VITE_SCHEDULES_TZ ??= 'Asia/Tokyo';
process.env.VITE_SCHEDULES_TZ ||= 'Asia/Tokyo';
process.env.VITE_MSAL_CLIENT_ID ??= '11111111-2222-3333-4444-555555555555';
process.env.VITE_MSAL_TENANT_ID ??= 'test-tenant';
process.env.VITE_MSAL_REDIRECT_URI ??= 'http://localhost:5173';

// Snapshot baseline env to restore after each test to avoid cross-test leakage
const ORIGINAL_ENV = { ...process.env };
const CLEAN_ENV = { ...ORIGINAL_ENV };
const ENV_KEYS_TO_CLEAR = [
	'VITE_SP_RESOURCE',
	'VITE_SP_SITE_RELATIVE',
	'VITE_SP_SITE',
	'VITE_SP_SCOPE_DEFAULT',
	'VITE_MSAL_SCOPES',
	'VITE_LOGIN_SCOPES',
	'VITE_MSAL_LOGIN_SCOPES',
	'VITE_SKIP_LOGIN',
	'VITE_SKIP_SHAREPOINT',
	'VITE_FORCE_SHAREPOINT',
	'VITE_FORCE_DEMO',
	'VITE_DEMO_MODE',
	'VITE_E2E_MSAL_MOCK',
	'VITE_E2E',
	'VITE_FEATURE_SCHEDULES_SP',
];

for (const key of ENV_KEYS_TO_CLEAR) {
	delete CLEAN_ENV[key];
}

type JestLikeMatcher = (this: unknown, ...args: unknown[]) => { pass: boolean; message(): string };

expect.extend(toHaveNoViolations as unknown as Record<string, JestLikeMatcher>);

beforeEach(() => {
	// Ensure every test starts from a clean environment (covers vi.stubEnv/import.meta.env)
	vi.unstubAllEnvs?.();
	process.env = { ...CLEAN_ENV };
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllEnvs?.();
	process.env = { ...CLEAN_ENV };
});

declare module 'vitest' {
	interface Assertion {
		toHaveNoViolations(): void;
	}
	interface AsymmetricMatchersContaining {
		toHaveNoViolations(): void;
	}
}

type CryptoLike = Crypto & { randomUUID?: () => string };
type GlobalWithCrypto = typeof globalThis & { crypto?: CryptoLike };

const globalWithCrypto = globalThis as GlobalWithCrypto;

if (!globalWithCrypto.crypto) {
	globalWithCrypto.crypto = webcrypto as CryptoLike;
}

if (!globalWithCrypto.crypto.randomUUID) {
	const cryptoInstance = globalWithCrypto.crypto;
	globalWithCrypto.crypto.randomUUID = function randomUUIDFallback(): ReturnType<Crypto['randomUUID']> {
		const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const random = cryptoInstance.getRandomValues(new Uint8Array(1))[0] & 0xf;
			const value = c === 'x' ? random : (random & 0x3) | 0x8;
			return value.toString(16);
		});
		return uuid as ReturnType<Crypto['randomUUID']>;
	};
}

// Use manual mock from src/__mocks__ for MSAL React
vi.mock('@azure/msal-react');

// Prevent SharePoint calls during tests by providing a lightweight client stub while retaining real createSpClient for unit tests
const mockUnifiedEvents = [
	{
		id: 'irc-event-1',
		resourceId: 'staff-1',
		title: '利用者宅訪問',
		start: '2024-01-01T09:00:00Z',
		end: '2024-01-01T10:00:00Z',
		extendedProps: {
			planId: 'plan-1',
			planType: 'visit',
			status: 'waiting',
			percentComplete: 0,
			diffMinutes: 0,
		},
	},
	{
		id: 'irc-event-2',
		resourceId: 'vehicle-1',
		title: 'デイサービス送迎',
		start: '2024-01-01T11:00:00Z',
		end: '2024-01-01T12:00:00Z',
		extendedProps: {
			planId: 'plan-2',
			planType: 'travel',
			status: 'in-progress',
			percentComplete: 50,
			diffMinutes: 0,
		},
	},
];

const mockSpClient = {
	listItems: vi.fn().mockResolvedValue([]),
	getItem: vi.fn().mockResolvedValue(null),
	createItem: vi.fn().mockResolvedValue({}),
	updateItem: vi.fn().mockResolvedValue({}),
	deleteItem: vi.fn().mockResolvedValue({}),
	getListItemsByTitle: vi.fn().mockResolvedValue([]),
	getListItemById: vi.fn().mockResolvedValue(null),
	addListItemByTitle: vi.fn().mockResolvedValue({ id: '1', etag: 'mock-etag' }),
	addItemByTitle: vi.fn().mockResolvedValue({ id: '1', etag: 'mock-etag' }),
	updateListItem: vi.fn().mockResolvedValue({ etag: 'new-etag' }),
	deleteListItem: vi.fn().mockResolvedValue(undefined),
	postBatch: vi.fn().mockResolvedValue([]),
	fetchRows: vi.fn().mockResolvedValue([]),
	fetchRowById: vi.fn().mockResolvedValue(null),
	spFetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
	getUnifiedEvents: vi.fn().mockResolvedValue(mockUnifiedEvents),
};

vi.mock('@/lib/spClient', async () => {
	const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
	return {
		...actual,
		useSP: () => mockSpClient,
		createSpClient: actual.createSpClient,
		createIrcSpClient: () => mockSpClient,
		mockSpClient,
	};
});

// Provide stable org store data to avoid SharePoint dependency in tests
vi.mock('@/features/org/store', () => ({
	useOrgStore: () => ({
		items: [
			{ id: 'org-1', label: 'デモ組織1' },
			{ id: 'org-2', label: 'デモ組織2' },
		],
		loading: false,
		error: null,
		loadedOnce: true,
		refresh: vi.fn(),
	}),
}));

// Skip hydration wiring when Router context is absent in isolated renders
vi.mock('@/hydration/RouteHydrationListener', async () => {
	const actual = await vi.importActual<typeof import('@/hydration/RouteHydrationListener')>(
		'@/hydration/RouteHydrationListener'
	);
	const Passthrough = ({ children }: { children?: React.ReactNode }) =>
		React.createElement(React.Fragment, null, children ?? null);
	return {
		...actual,
		RouteHydrationListener: Passthrough,
		RouteHydrationErrorBoundary: actual.RouteHydrationErrorBoundary ?? Passthrough,
		default: Passthrough,
	};
});
