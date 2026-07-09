import { z } from 'zod';

import { getRuntimeEnv } from '@/env';

type RuntimeEnv = Record<string, string | undefined>;
const trim = (value: string | undefined): string => value?.trim() ?? '';

const hasEnvFlag = (value: string | undefined): boolean => {
  const normalized = trim(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isNonProdMode = (rawMode: string | undefined): boolean => {
  const mode = trim(rawMode).toLowerCase();
  return mode === 'development' || mode === 'dev' || mode === 'test' || mode === 'e2e';
};

const isProductionLike = (env: RuntimeEnv): boolean => {
  const mode = trim(env.MODE).toLowerCase();
  const nodeEnv = trim(env.NODE_ENV).toLowerCase();
  if (isNonProdMode(mode) || isNonProdMode(nodeEnv)) {
    return false;
  }
  return mode === 'production' || nodeEnv === 'production' || mode === '' || nodeEnv === '';
};

const shouldSkipMsalValidation = (env: RuntimeEnv): boolean => (
  hasEnvFlag(env.VITE_E2E) ||
  hasEnvFlag(env.VITE_E2E_MSAL_MOCK) ||
  hasEnvFlag(env.VITE_DEMO_MODE) ||
  hasEnvFlag(env.VITE_DEMO) ||
  hasEnvFlag(env.VITE_FORCE_DEMO) ||
  hasEnvFlag(env.VITE_SKIP_LOGIN)
);

const msalEnvSchema = z.object({
  VITE_MSAL_CLIENT_ID: z.string().trim().min(1, 'VITE_MSAL_CLIENT_ID is required'),
  VITE_MSAL_TENANT_ID: z.string().trim().min(1, 'VITE_MSAL_TENANT_ID is required'),
  VITE_MSAL_REDIRECT_URI: z.string().trim().optional(),
  VITE_MSAL_AUTHORITY: z.string().trim().optional(),
});

const formatSchemaErrors = (errors: z.ZodIssue[]): string => {
  if (errors.length === 0) {
    return 'none';
  }
  return errors
    .map((error) => `- ${error.path.join('.')} ${error.message}`)
    .join('\n');
};

const resolveMsalRedirect = (env: RuntimeEnv): string => trim(env.VITE_MSAL_REDIRECT_URI);
const resolveMsalAuthority = (env: RuntimeEnv): string => trim(env.VITE_MSAL_AUTHORITY);

const validateRedirectUri = (uri: string): void => {
  if (!uri) {
    throw new Error('[env] VITE_MSAL_REDIRECT_URI is missing.');
  }
  try {
    new URL(uri);
  } catch {
    throw new Error(`[env] VITE_MSAL_REDIRECT_URI is invalid: ${uri}`);
  }
};

const validateAuthorityUri = (uri: string): void => {
  if (!uri) return;
  try {
    new URL(uri);
  } catch {
    throw new Error(`[env] VITE_MSAL_AUTHORITY is invalid: ${uri}`);
  }
};

export type EnvSchema = z.infer<typeof msalEnvSchema>;

export function validateEnv(): EnvSchema {
  const env = getRuntimeEnv() as RuntimeEnv;
  if (shouldSkipMsalValidation(env)) {
    return env as EnvSchema;
  }

  const parsed = msalEnvSchema.safeParse(env);
  if (!parsed.success) {
    const message = [
      '[env] Invalid MSAL environment variables.',
      'Missing/invalid:',
      formatSchemaErrors(parsed.error.issues),
      '',
      'Check and set:',
      '  - VITE_MSAL_CLIENT_ID',
      '  - VITE_MSAL_TENANT_ID',
      ...(isProductionLike(env)
        ? [
            '  - VITE_MSAL_REDIRECT_URI (app origin URL e.g. https://localhost:5173)',
          ]
        : []),
      '  - VITE_MSAL_AUTHORITY (optional but recommended, e.g. https://login.microsoftonline.com/<tenant-id>)',
      '',
      'Reference: .env.example',
    ].join('\n');
    throw new Error(message);
  }

  if (isProductionLike(env)) {
    validateRedirectUri(resolveMsalRedirect(env));
  }

  validateAuthorityUri(resolveMsalAuthority(env));

  return parsed.data;
}
