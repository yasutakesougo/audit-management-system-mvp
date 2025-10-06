type EnvShape = ImportMetaEnv & Record<string, string | boolean | number | undefined>;

const resolveImportMetaEnv = (): Partial<EnvShape> => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env) {
      return (import.meta as ImportMeta).env as EnvShape;
    }
  } catch {
    // ignore access errors (e.g., older tooling)
  }
  return {};
};

const resolveProcessEnv = (): Partial<EnvShape> => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as unknown as EnvShape;
  }
  return {};
};

const merged = {
  ...resolveProcessEnv(),
  ...resolveImportMetaEnv(),
};

export const env = Object.freeze(merged) as EnvShape;
