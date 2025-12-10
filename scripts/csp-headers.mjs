const CLEAN_TRAILING_SLASH = /\/?$/;

const defaultConnectSources = [
  "'self'",
  'https://login.microsoftonline.com',
  'https://*.microsoftonline.com',
  'https://graph.microsoft.com',
  'https://aadcdn.msftauth.net',
  'https://*.sharepoint.com',
];

/**
 * Build CSP header metadata for preview/test environments.
 * @param {object} options
 * @param {string | undefined} options.siteUrl
 * @param {string | undefined} options.spResource
 * @param {string | undefined} options.spBaseUrl
 * @param {string | undefined} options.collectorOrigin
 * @param {string | undefined} options.collectorPrefix
 * @param {string | undefined} options.collectorPort
 * @param {boolean | undefined} options.enforce
 * @param {boolean | undefined} options.disabled
 * @returns {{ headerName: string | null, headerValue: string | null, reportToValue: string | null, reportEndpoint: string }}
 */
export function buildCspConfig({
  siteUrl,
  spResource,
  spBaseUrl,
  collectorOrigin,
  collectorPrefix,
  collectorPort,
  enforce,
  disabled,
} = {}) {
  const prefix = collectorPrefix || '/__csp__';
  const origin = (collectorOrigin || `http://localhost:${collectorPort || '8787'}`).replace(
    CLEAN_TRAILING_SLASH,
    '',
  );
  const reportEndpoint = `${origin}${prefix}/report`;

  if (disabled) {
    return {
      headerName: null,
      headerValue: null,
      reportToValue: null,
      reportEndpoint,
    };
  }

  const connectSrc = new Set([
    ...defaultConnectSources,
    origin,
    siteUrl,
    spResource,
    spBaseUrl,
  ].filter(Boolean));

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self'",
    "frame-src 'self' https://login.microsoftonline.com",
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    `report-uri ${reportEndpoint}`,
    'report-to csp-endpoint',
  ].join('; ');

  const reportToValue = JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [{ url: reportEndpoint }],
  });

  return {
    headerName: enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    headerValue: directives,
    reportToValue,
    reportEndpoint,
  };
}
