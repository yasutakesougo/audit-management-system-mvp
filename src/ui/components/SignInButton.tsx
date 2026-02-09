import { useAuth } from '@/auth/useAuth';
import { useMsalContext } from '@/auth/MsalProvider';
import { getAppConfig, readEnv } from '@/lib/env';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const preferredLoginFlow = readEnv('VITE_MSAL_LOGIN_FLOW', 'popup').trim().toLowerCase();
const useRedirectLogin = preferredLoginFlow === 'redirect';

const { isDev: isDevEnv } = getAppConfig();

const SignInButton: React.FC = () => {
const { instance, accounts } = useMsalContext();
const { signIn } = useAuth();
const [signingIn, setSigningIn] = useState(false);
	const navigate = useNavigate();
	const signedIn = accounts.length > 0;
	const tooltip = useMemo(() => {
		if (!signedIn) return '未サインイン';
		const account = (instance.getActiveAccount() as { name?: string; username?: string } | null) ?? (accounts[0] as { name?: string; username?: string } | undefined) ?? null;
		return account?.name || account?.username || 'Signed in';
	}, [accounts, instance, signedIn]);

	const handleSignIn = async () => {
		if (signingIn) return;
		try {
			setSigningIn(true);
			const result = await signIn();
			if (result?.success && !useRedirectLogin) {
				navigate('/dashboard', { replace: true });
			}
		} catch (error) {
			console.error('[auth] sign-in failed', error);
		} finally {
			setSigningIn(false);
		}
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
				if (isDevEnv) {
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
			<Button
				color="inherit"
				variant="outlined"
				size="small"
				onClick={handleSignIn}
				disabled={signingIn}
				aria-label="サインイン"
				sx={{ height: 28, minHeight: 28, px: 1.25, py: 0, alignSelf: 'center', lineHeight: 1, whiteSpace: 'nowrap' }}
			>
				{signingIn ? 'サインイン中…' : 'サインイン'}
			</Button>
		);
	}

	return (
		<Tooltip title={tooltip}>
			<Button
				color="inherit"
				variant="outlined"
				size="small"
				onClick={handleSignOut}
				aria-label="サインアウト"
				sx={{ height: 28, minHeight: 28, px: 1.25, py: 0, alignSelf: 'center', lineHeight: 1, whiteSpace: 'nowrap' }}
			>
				サインアウト
			</Button>
		</Tooltip>
	);
};

export default SignInButton;
