const truthy = (value) =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const isPlaceholder = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  if (normalized.includes('<') || normalized.includes('__')) return true;
  if (/<[^>]+>/.test(normalized)) return true;
  if (lower.includes('fill') || lower.includes('your')) return true;
  return false;
};

const env = process.env;
const errors = [];
const warnings = [];

const requiredList = String(env.ENV_VALIDATE_REQUIRED || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const shouldSkipSharePoint =
  truthy(env.VITE_E2E) ||
  truthy(env.VITE_E2E_MSAL_MOCK) ||
  truthy(env.VITE_SKIP_LOGIN) ||
  truthy(env.VITE_SKIP_SHAREPOINT) ||
  truthy(env.VITE_DEMO_MODE);

const requireSharePoint = truthy(env.ENV_VALIDATE_SP_STRICT) && !shouldSkipSharePoint;

const validateRequired = (key) => {
  const value = env[key];
  if (!value) {
    errors.push(`Missing required env: ${key}`);
    return;
  }
  if (isPlaceholder(value)) {
    errors.push(`Placeholder value detected for ${key}`);
  }
};

const validateSharePoint = () => {
  const spResource = env.VITE_SP_RESOURCE;
  const spSiteRel = env.VITE_SP_SITE_RELATIVE || env.VITE_SP_SITE;
  const spSiteUrl = env.VITE_SP_SITE_URL;
  const spScope = env.VITE_SP_SCOPE_DEFAULT;

  const resourcePattern = /^https:\/\/[^/]+\.sharepoint\.com$/i;
  const scopePattern = /^https:\/\/[^/]+\.sharepoint\.com\/AllSites\.(Read|FullControl)$/i;

  if (spResource) {
    if (isPlaceholder(spResource)) {
      errors.push('Placeholder value detected for VITE_SP_RESOURCE');
    } else if (!resourcePattern.test(spResource.trim().replace(/\/+$/, ''))) {
      errors.push(`Invalid VITE_SP_RESOURCE format: ${spResource}`);
    }
  }

  if (spSiteRel) {
    if (isPlaceholder(spSiteRel)) {
      errors.push('Placeholder value detected for VITE_SP_SITE_RELATIVE');
    } else {
      const normalized = spSiteRel.trim();
      if (!normalized.startsWith('/sites/') && !normalized.startsWith('/teams/')) {
        errors.push(`Invalid VITE_SP_SITE_RELATIVE format: ${spSiteRel}`);
      }
    }
  }

  if (spSiteUrl) {
    if (isPlaceholder(spSiteUrl)) {
      errors.push('Placeholder value detected for VITE_SP_SITE_URL');
    } else {
      try {
        const url = new URL(spSiteUrl);
        if (url.protocol !== 'https:' || !/\.sharepoint\.com$/i.test(url.hostname)) {
          errors.push(`Invalid VITE_SP_SITE_URL format: ${spSiteUrl}`);
        }
      } catch {
        errors.push(`Invalid VITE_SP_SITE_URL format: ${spSiteUrl}`);
      }
    }
  }

  if (spScope) {
    if (isPlaceholder(spScope)) {
      errors.push('Placeholder value detected for VITE_SP_SCOPE_DEFAULT');
    } else if (!scopePattern.test(spScope.trim())) {
      errors.push(`Invalid VITE_SP_SCOPE_DEFAULT format: ${spScope}`);
    }
  }

  if (requireSharePoint) {
    const hasSiteUrl = !!spSiteUrl;
    const hasResourcePair = !!(spResource && spSiteRel);
    if (!hasSiteUrl && !hasResourcePair) {
      errors.push('SharePoint config missing: set VITE_SP_SITE_URL or VITE_SP_RESOURCE + VITE_SP_SITE_RELATIVE');
    }
  }
};

for (const key of requiredList) {
  validateRequired(key);
}

validateSharePoint();

if (warnings.length) {
  console.warn('⚠️  Env validation warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error('❌ Env validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('✅ Env validation passed');