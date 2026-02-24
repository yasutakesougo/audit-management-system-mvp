import '@formatjs/intl-datetimeformat/add-all-tz';
import '@formatjs/intl-datetimeformat/polyfill';
import '@formatjs/intl-getcanonicallocales';
// Apply React Router v7 future flags globally across tests
import './tests/setup/router-future-flags';
// Vitest global setup: polyfill crypto.randomUUID if absent (Node < 19 environments)
import { clearEnvCache } from '@/env';
import { resetParsedEnvForTests } from '@/lib/env.schema';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'crypto';
import { toHaveNoViolations } from 'jest-axe';
import * as React from 'react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

process.env.TZ ??= 'Asia/Tokyo';
// Provide safe defaults for MSAL-dependent modules during unit tests
process.env.VITE_SCHEDULES_TZ ??= 'Asia/Tokyo';
process.env.VITE_SCHEDULES_TZ ||= 'Asia/Tokyo';
process.env.VITE_MSAL_CLIENT_ID ??= '11111111-2222-3333-4444-555555555555';
process.env.VITE_MSAL_TENANT_ID ??= 'test-tenant';
process.env.VITE_MSAL_REDIRECT_URI ??= 'http://localhost:5173';

// Snapshot baseline env to restore after each test to avoid cross-test leakage
// CRITICAL: Only restore keys that tests explicitly modify - never replace entire process.env
// This prevents accidentally clobbering Vitest/Node/CI internal variables
const ENV_KEYS_TO_CLEAR = [
	// Test-specific VITE vars that should be cleared after each test
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

// Only snapshot keys that this setup explicitly manages
// Other env vars are left untouched to preserve Vitest/Node/CI state
const ENV_KEYS_TO_RESTORE = ['TZ', 'VITE_SCHEDULES_TZ', 'VITE_MSAL_CLIENT_ID', 'VITE_MSAL_TENANT_ID', 'VITE_MSAL_REDIRECT_URI'] as const;
const CLEAN_ENV = Object.fromEntries(ENV_KEYS_TO_RESTORE.map((k) => [k, process.env[k]]));

type JestLikeMatcher = (this: unknown, ...args: unknown[]) => { pass: boolean; message(): string };

expect.extend(toHaveNoViolations as unknown as Record<string, JestLikeMatcher>);

beforeEach(() => {
	// Ensure every test starts from a clean environment (covers vi.stubEnv/import.meta.env)
	vi.unstubAllEnvs?.();
	clearEnvCache();
	resetParsedEnvForTests();

	// Clear test-specific vars: delete only keys we explicitly manage
	for (const key of ENV_KEYS_TO_CLEAR) {
		if (key in process.env) {
			delete process.env[key];
		}
	}

	// Restore only tracked setup vars to their baseline state
	for (const [k, v] of Object.entries(CLEAN_ENV)) {
		if (v === undefined) {
			delete process.env[k];
		} else {
			process.env[k] = v;
		}
	}
});

afterEach(() => {
	cleanup();
	// Use clearAllMocks instead of restoreAllMocks to preserve vi.mock() registrations
	// restoreAllMocks can interfere with module-level vi.mock() calls
	vi.clearAllMocks();
	vi.clearAllTimers();
	vi.useRealTimers(); // Prevent fake timers from leaking across tests
	vi.unstubAllEnvs?.();
	clearEnvCache();
	resetParsedEnvForTests();

	// Clear test-specific vars: delete only keys we explicitly manage
	for (const key of ENV_KEYS_TO_CLEAR) {
		if (key in process.env) {
			delete process.env[key];
		}
	}

	// Restore only tracked setup vars to their baseline state
	for (const [k, v] of Object.entries(CLEAN_ENV)) {
		if (v === undefined) {
			delete process.env[k];
		} else {
			process.env[k] = v;
		}
	}
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

// ✅ AppShell test support: Mock browser APIs
const createStorageMock = () => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = String(value);
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		length: 0,
		key: vi.fn((index: number) => Object.keys(store)[index] || null),
	};
};

if (typeof window !== 'undefined') {
	const mockLS = createStorageMock();
	vi.stubGlobal('localStorage', mockLS);

	const mockSS = createStorageMock();
	vi.stubGlobal('sessionStorage', mockSS);
}

// ResizeObserver for Drawer / Grid / Portal components
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverMock;

// matchMedia for MUI responsive hooks
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock useMediaQuery (MUI) for AppShell Drawer tests
vi.mock('@mui/material/useMediaQuery', () => ({
	default: () => false, // Always desktop mode for tests
}));
