// Vitest global setup: polyfill crypto.randomUUID if absent (Node < 19 environments)
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'crypto';
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';

// Provide safe defaults for MSAL-dependent modules during unit tests
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
