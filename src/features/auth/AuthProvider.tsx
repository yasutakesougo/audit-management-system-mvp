import { MsalProvider } from '@/auth/MsalProvider';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/**
 * Legacy shim: re-export the unified MsalProvider so any remaining imports continue to work.
 */
export const AuthProvider = ({ children }: Props): JSX.Element => {
  return <MsalProvider>{children}</MsalProvider>;
};
