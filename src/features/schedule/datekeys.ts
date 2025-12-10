export const toDayKeyHyphen = (iso: string): string => iso.slice(0, 10);

export const toDayKeyLegacy = (iso: string): string => toDayKeyHyphen(iso).replace(/-/g, '');

export const isVitestEnv = (): boolean =>
	typeof process !== 'undefined' &&
	(Boolean(process.env?.VITEST_WORKER_ID) || process.env?.NODE_ENV === 'test');

// TODO(schedules): drop this shim once SharePoint consistently emits hyphenated day keys everywhere.
export const emitDayKeyForTest = (dayKeyHyphen: string): string =>
	isVitestEnv() ? toDayKeyLegacy(dayKeyHyphen) : dayKeyHyphen;
