import { useMsalContext } from '@/auth/MsalProvider';
import { SP_RESOURCE } from '@/auth/msalConfig';
import { readEnv } from '@/lib/env';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import React, { useEffect, useMemo } from 'react';

const defaultScopes = [`${SP_RESOURCE}/.default`];
const preferredLoginFlow = readEnv('VITE_MSAL_LOGIN_FLOW', 'popup').trim().toLowerCase();
const useRedirectLogin = preferredLoginFlow === 'redirect';

const SignInButton: React.FC = () => {
	const { instance, accounts } = useMsalContext();
	const signedIn = accounts.length > 0;
	const tooltip = useMemo(() => {
		if (!signedIn) return '未サインイン';
		const account = (instance.getActiveAccount() as { name?: string; username?: string } | null) ?? (accounts[0] as { name?: string; username?: string } | undefined) ?? null;
		return account?.name || account?.username || 'Signed in';
	}, [accounts, instance, signedIn]);

	const handleSignIn = async () => {
		try {
			if (useRedirectLogin) {
				await instance.loginRedirect({ scopes: defaultScopes, prompt: 'select_account' });
				return;
			}
			const res = await instance.loginPopup({ scopes: defaultScopes, prompt: 'select_account' });
			const active = ensureActiveAccount((res.account as Record<string, unknown> | null) ?? null);
			if (!active) {
				console.warn('[auth] login succeeded but no account returned.');
				return;
			}
			if (import.meta.env.DEV) {
				const label = (active as { username?: string; homeAccountId?: string }).username ?? (active as { homeAccountId?: string }).homeAccountId;
				console.info('[auth] signed in:', label ?? '(unknown account)');
				console.info('[auth] accounts cache:', instance.getAllAccounts());
			}
		} catch (error) {
			console.error('[auth] loginPopup failed', error);
		}
	};
	const ensureActiveAccount = (candidate?: Record<string, unknown> | null) => {
		if (candidate) {
			instance.setActiveAccount(candidate as never);
			return candidate;
		}
		const [fallback] = instance.getAllAccounts();
		if (fallback) {
			instance.setActiveAccount(fallback);
			return fallback as Record<string, unknown>;
		}
		return null;
	};

	useEffect(() => {
		if (!accounts.length) {
			return;
		}
		const active = instance.getActiveAccount();
		if (!active) {
			const [first] = accounts;
			if (first) {
				instance.setActiveAccount(first as never);
				if (import.meta.env.DEV) {
					const label = (first as { username?: string; homeAccountId?: string }).username ?? (first as { homeAccountId?: string }).homeAccountId;
					console.info('[auth] ensureActiveAccount effect -> setActiveAccount', label ?? '(unknown account)');
				}
			}
		}
	}, [accounts, instance]);

	const handleSignOut = async () => {
		const instanceWithPopup = instance as unknown as { logoutPopup?: () => Promise<void>; logoutRedirect: () => Promise<void> };
		try {
			if (typeof instanceWithPopup.logoutPopup === 'function') {
				await instanceWithPopup.logoutPopup();
			} else {
				await instanceWithPopup.logoutRedirect();
			}
		} catch (error) {
			console.error('[auth] logout failed', error);
		} finally {
			instance.setActiveAccount(null);
		}
	};

	if (!signedIn) {
		return (
			<Button color="inherit" variant="outlined" size="small" onClick={handleSignIn} aria-label="サインイン">
				サインイン
			</Button>
		);
	}

	return (
		<Tooltip title={tooltip}>
			<Button color="inherit" variant="outlined" size="small" onClick={handleSignOut} aria-label="サインアウト">
				サインアウト
			</Button>
		</Tooltip>
	);
};

export default SignInButton;
