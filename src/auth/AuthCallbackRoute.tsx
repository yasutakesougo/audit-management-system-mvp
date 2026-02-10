import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getPcaSingleton } from '@/auth/azureMsal';

const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect';

export function AuthCallbackRoute(): JSX.Element {
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const msalInstance = await getPcaSingleton();
        await msalInstance.handleRedirectPromise();

        const to = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || '/dashboard';
        sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
        if (!cancelled) {
          navigate(to, { replace: true });
        }
      } catch (error) {
        console.error('[auth] callback handling failed', error);
        if (!cancelled) {
          navigate('/dashboard', { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return <div style={{ padding: 16 }}>サインイン処理中…</div>;
}
