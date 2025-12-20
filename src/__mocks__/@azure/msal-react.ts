import { vi } from 'vitest';
import type React from 'react';

export const useMsal = vi.fn(() => ({
	instance: {
		getAllAccounts: vi.fn(() => []),
		getActiveAccount: vi.fn(() => null),
		setActiveAccount: vi.fn(),
		acquireTokenSilent: vi.fn(),
		loginRedirect: vi.fn(),
		logoutRedirect: vi.fn()
	},
	accounts: [],
	inProgress: 'none' as const
}));

export const useMsalAuthentication = vi.fn(() => ({
	login: vi.fn(),
	result: null,
	error: null
}));

export const MsalProvider = ({ children }: { children: React.ReactNode }) => children;

export const AuthenticatedTemplate = ({ children }: { children: React.ReactNode }) => children;

export const UnauthenticatedTemplate = () => null;
