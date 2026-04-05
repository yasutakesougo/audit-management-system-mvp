export const ADMIN_SURFACES = [
  '/analysis',
  '/analysis/*',
  '/ops',
  '/handoff-analysis',
  '/exceptions',
  '/exceptions/audit',
  '/admin/*',
] as const;

const normalizePath = (pathname: string): string => {
  if (!pathname) return '/';
  const stripped = pathname.split('?')[0].split('#')[0].replace(/\/$/, '');
  return stripped || '/';
};

export const isAdminSurfacePath = (pathname: string): boolean => {
  const normalizedPath = normalizePath(pathname);

  return ADMIN_SURFACES.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2);
      return normalizedPath === base || normalizedPath.startsWith(`${base}/`);
    }

    return normalizedPath === pattern;
  });
};
