/** Shared route boundary for diagnostics and its SharePoint transport. */
export function isDiagnosticReadonlyPath(pathname: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    // Malformed routing input must not enable background writes.
    return true;
  }
  return path === '/admin/status' || path.startsWith('/admin/status/');
}

export function isReadonlyHttpMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}
