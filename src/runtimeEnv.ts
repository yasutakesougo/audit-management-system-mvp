export type RuntimeEnvSource = Record<string, unknown>;
export type RuntimeEnvRecord = Record<string, string | undefined>;

const isUsableRuntimeValue = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const usableEntries = (source: RuntimeEnvSource): Array<[string, string]> =>
  Object.entries(source).filter((entry): entry is [string, string] => isUsableRuntimeValue(entry[1]));

export const mergeRuntimeEnv = (
  buildEnv: RuntimeEnvSource,
  runtimeFileEnv: RuntimeEnvSource,
  workerInlineEnv: RuntimeEnvSource,
): RuntimeEnvRecord => {
  const merged: RuntimeEnvRecord = {};

  for (const [key, value] of usableEntries(buildEnv)) merged[key] = value;
  for (const [key, value] of usableEntries(runtimeFileEnv)) merged[key] = value;
  for (const [key, value] of usableEntries(workerInlineEnv)) merged[key] = value;

  return merged;
};

export const resolveRuntimeEnv = async ({
  buildEnv,
  workerInlineEnv,
  loadRuntimeEnv,
}: {
  buildEnv: RuntimeEnvSource;
  workerInlineEnv: RuntimeEnvSource;
  loadRuntimeEnv: () => Promise<RuntimeEnvSource>;
}): Promise<RuntimeEnvRecord> => {
  let runtimeFileEnv: RuntimeEnvSource = {};

  try {
    runtimeFileEnv = await loadRuntimeEnv();
  } catch {
    runtimeFileEnv = {};
  }

  return mergeRuntimeEnv(buildEnv, runtimeFileEnv, workerInlineEnv);
};
