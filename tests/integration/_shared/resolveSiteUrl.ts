export function resolveSharePointSiteUrl(): string {
  const explicit = process.env.SHAREPOINT_SITE?.trim();
  if (explicit) return explicit;

  const resource = (process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com').trim();
  const relative = (process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test').trim();

  // normalize
  const r = resource.endsWith('/') ? resource.slice(0, -1) : resource;
  const rel = relative.startsWith('/') ? relative : `/${relative}`;
  return `${r}${rel}`;
}
