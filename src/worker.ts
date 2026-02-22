/**
 * Cloudflare Workers custom handler for Assets
 * SPA fallback + COOP header for MSAL popup authentication
 */

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  ALLOWED_TENANT_ID?: string;
  ORG_ID_OVERRIDE?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_SERVICE_ACCOUNT_EMAIL?: string;
  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
}

type GraphMeResponse = {
  id?: string;
  displayName?: string;
  userPrincipalName?: string;
};

type AccessTokenClaims = {
  tid?: string;
  oid?: string;
  name?: string;
  preferred_username?: string;
};

type ServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const jsonResponse = (status: number, payload: unknown): Response => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
};

const toBase64Url = (value: string | ArrayBuffer): string => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const decodeBase64UrlJson = <T>(segment: string): T => {
  const normalized = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const decoded = atob(padded);
  return JSON.parse(decoded) as T;
};

const decodeJwtPayload = (token: string): AccessTokenClaims => {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('invalid JWT format');
  }
  return decodeBase64UrlJson<AccessTokenClaims>(parts[1]);
};

const fetchGraphMe = async (accessToken: string): Promise<GraphMeResponse> => {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`graph /me failed: ${response.status}`);
  }

  return (await response.json()) as GraphMeResponse;
};

const normalizePrivateKey = (value: string): string => {
  return value.replace(/\\n/g, '\n');
};

const resolveServiceAccountConfig = (env: Env): ServiceAccountConfig => {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    const projectId = parsed.project_id ?? env.FIREBASE_PROJECT_ID;
    const clientEmail = parsed.client_email;
    const privateKey = parsed.private_key;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields');
    }

    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
    };
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_EMAIL || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Firebase service account secrets are not configured');
  }

  return {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    privateKey: normalizePrivateKey(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY),
  };
};

const createFirebaseCustomToken = async (params: {
  uid: string;
  orgId: string;
  actorName: string;
  actorId: string;
  serviceAccount: ServiceAccountConfig;
}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const aud = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: params.serviceAccount.clientEmail,
    sub: params.serviceAccount.clientEmail,
    aud,
    iat: now,
    exp,
    uid: params.uid,
    claims: {
      orgId: params.orgId,
      actorId: params.actorId,
      actorName: params.actorName,
    },
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const keyData = normalizePrivateKey(params.serviceAccount.privateKey)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const keyBytes = Uint8Array.from(atob(keyData), (char) => char.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${toBase64Url(signature)}`;
};

const parseAllowedTenantIds = (raw: string | undefined): Set<string> => {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
};

const handleFirebaseExchange = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  if (!token) {
    return jsonResponse(401, { error: 'missing_bearer_token' });
  }

  let claims: AccessTokenClaims;
  try {
    claims = decodeJwtPayload(token);
  } catch {
    return jsonResponse(401, { error: 'invalid_token_format' });
  }

  const allowedTenantIds = parseAllowedTenantIds(env.ALLOWED_TENANT_ID);
  const tenantId = claims.tid;
  if (!tenantId) {
    return jsonResponse(403, { error: 'tenant_not_found' });
  }

  if (allowedTenantIds.size > 0 && !allowedTenantIds.has(tenantId)) {
    return jsonResponse(403, { error: 'tenant_not_allowed' });
  }

  let graphMe: GraphMeResponse;
  try {
    graphMe = await fetchGraphMe(token);
  } catch (error) {
    console.error('[exchange] graph verification failed', error);
    return jsonResponse(401, { error: 'token_verification_failed' });
  }

  const actorOid = claims.oid ?? graphMe.id;
  if (!actorOid) {
    return jsonResponse(403, { error: 'actor_not_resolved' });
  }

  const orgId = env.ORG_ID_OVERRIDE?.trim() || tenantId;
  const actorName = claims.name ?? claims.preferred_username ?? graphMe.displayName ?? graphMe.userPrincipalName ?? '';
  const actorId = `aad:${actorOid}`;

  let serviceAccount: ServiceAccountConfig;
  try {
    serviceAccount = resolveServiceAccountConfig(env);
  } catch (error) {
    console.error('[exchange] service account config error', error);
    return jsonResponse(500, { error: 'service_account_not_configured' });
  }

  try {
    const firebaseCustomToken = await createFirebaseCustomToken({
      uid: actorId,
      orgId,
      actorName,
      actorId,
      serviceAccount,
    });

    return jsonResponse(200, {
      firebaseCustomToken,
      orgId,
      actor: {
        id: actorId,
        name: actorName,
      },
      expiresInSec: 3600,
    });
  } catch (error) {
    console.error('[exchange] custom token creation failed', error);
    return jsonResponse(500, { error: 'custom_token_creation_failed' });
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const serveIndex = async (): Promise<Response> => {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/index.html';
      indexUrl.search = '';
      const indexRequest = new Request(indexUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      });
      const indexResponse = await env.ASSETS.fetch(indexRequest);

      const headers = new Headers(indexResponse.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      headers.set('Cache-Control', 'no-store, must-revalidate');
      headers.set('Content-Type', 'text/html; charset=UTF-8');

      return new Response(indexResponse.body, {
        status: 200,
        headers,
      });
    };

    if (url.pathname === '/api/firebase/exchange') {
      return handleFirebaseExchange(request, env);
    }

    // API routes - pass through
    if (url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === '/auth/callback') {
      return serveIndex();
    }

    // Static files (has file extension) - serve as-is (no rewrites)
    if (url.pathname.includes('.')) {
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        headers,
      });
    }

    // SPA routes (no extension) - always return index.html
    return serveIndex();
  },
};
