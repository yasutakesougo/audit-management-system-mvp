import React from 'react';
import { MsalProvider as Provider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

const msalInstance = new PublicClientApplication(msalConfig);

export const MsalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider instance={msalInstance}>{children}</Provider>
);
