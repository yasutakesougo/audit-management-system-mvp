/**
 * Vitest Global Setup (Main Branch)
 *
 * 🛠️ Hybrid Isolation Model
 * -------------------------
 * This setup implements a "Hybrid Isolation" model to balance test performance,
 * module-level dependency support, and test isolation:
 *
 * 1. Persistent Stubs: Browser APIs (localStorage, matchMedia, etc.) are stubbed
 *    at the module level. This ensures they are available during module evaluation
 *    when test files are imported, preventing "ReferenceError: localStorage is not defined"
 *    in high-concurrency environments.
 *
 * 2. Per-Test Data Clearance: `beforeEach` hooks clear the *data* within these mocks
 *    (e.g., localStorage.clear()) without un-stubbing the global objects themselves.
 *
 * 3. Minimal Global Side Effects: We avoid `vi.unstubAllGlobals()` in `afterEach`
 *    because it destructively removes the stubs needed by other modules still being
 *    evaluated or lazy-loaded. Use `mockRestore()` on specific spies instead.
 */

import { clearEnvCache } from '@/lib/env';
import { resetParsedEnvForTests } from '@/lib/env.schema';
import '@formatjs/intl-datetimeformat/add-all-tz';
import '@formatjs/intl-datetimeformat/polyfill';
import '@formatjs/intl-getcanonicallocales';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'crypto';
import { toHaveNoViolations } from 'jest-axe';
import * as React from 'react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import './tests/setup/router-future-flags';

process.env.TZ ??= 'Asia/Tokyo';

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

const mockLS = createStorageMock();
const mockSS = createStorageMock();

if (typeof window !== 'undefined') {
	vi.stubGlobal('localStorage', mockLS);
	vi.stubGlobal('sessionStorage', mockSS);

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
}

// ResizeObserver for Drawer / Grid / Portal components
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Snapshotted baseline env
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

const ENV_KEYS_TO_RESTORE = ['TZ', 'VITE_SCHEDULES_TZ', 'VITE_MSAL_CLIENT_ID', 'VITE_MSAL_TENANT_ID', 'VITE_MSAL_REDIRECT_URI'] as const;
const CLEAN_ENV = Object.fromEntries(ENV_KEYS_TO_RESTORE.map((k) => [k, process.env[k]]));

// Consolidated environment and browser API setup
beforeEach(() => {
	// Ensure every test starts from a clean environment (covers vi.stubEnv/import.meta.env)
	vi.unstubAllEnvs?.();
	clearEnvCache();
	resetParsedEnvForTests();

	// Clear browser storage mocks
	mockLS.clear();
	mockSS.clear();

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
	vi.clearAllMocks();
	vi.clearAllTimers();
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

// Provide safe defaults for MSAL-dependent modules during unit tests
process.env.VITE_SCHEDULES_TZ ??= 'Asia/Tokyo';
process.env.VITE_MSAL_CLIENT_ID ??= '11111111-2222-3333-4444-555555555555';
process.env.VITE_MSAL_TENANT_ID ??= 'test-tenant';
process.env.VITE_MSAL_REDIRECT_URI ??= 'http://localhost:5173';

type JestLikeMatcher = (this: unknown, ...args: unknown[]) => { pass: boolean; message(): string };
expect.extend(toHaveNoViolations as unknown as Record<string, JestLikeMatcher>);

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

// Prevent SharePoint calls during tests
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
		resourceId: 'staff-2',
		title: 'デイサービス送迎',
		start: '2024-01-01T13:00:00Z',
		end: '2024-01-01T14:00:00Z',
		extendedProps: {
			planId: 'plan-2',
			planType: 'transport',
			status: 'waiting',
			percentComplete: 0,
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
	getResources: vi.fn().mockResolvedValue([]),
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

// Provide stable org store data
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

// Skip hydration wiring
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

// Mock useMediaQuery (MUI) for AppShell Drawer tests
vi.mock('@mui/material/useMediaQuery', () => ({
	default: () => false, // Always desktop mode for tests
}));
