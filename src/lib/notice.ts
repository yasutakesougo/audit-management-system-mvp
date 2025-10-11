import { allowWriteFallback, isDemoModeEnabled } from './env';
import type { SafeError } from './errors';

export type NoticedError = SafeError & { userMessage?: string };

type ErrorClassifier = (error: SafeError) => boolean;

type ErrorEntry = {
	match: ErrorClassifier;
	message: string;
};

const TRIM_RE = /\s+/g;

const DEFAULT_MESSAGE = '操作に失敗しました。時間をおいて再度お試しください。';

const ENTRIES: ErrorEntry[] = [
	{
		match: (error) => typeof error.code === 'string' && /timeout|network|503|504/.test(error.code.toLowerCase()),
		message: 'ネットワークの状態を確認して、再度お試しください。',
	},
	{
		match: (error) => typeof error.code === 'string' && /401|403/.test(error.code),
		message: '再認証が必要です。サインインし直してください。',
	},
	{
		match: (error) => typeof error.message === 'string' && /schema|field|property/.test(error.message.toLowerCase()),
		message: '項目定義が最新ではありません。システム管理者に連絡してください。',
	},
];

const normalizeWhitespace = (value?: string): string => (value ?? '').replace(TRIM_RE, ' ').trim();

export const withUserMessage = (error: SafeError, fallbackMessage?: string): NoticedError => {
	const normalizedMessage = normalizeWhitespace(error.message);
	for (const entry of ENTRIES) {
		if (entry.match(error)) {
			return {
				...error,
				message: normalizedMessage || DEFAULT_MESSAGE,
				userMessage: entry.message,
			};
		}
	}

	return {
		...error,
		message: normalizedMessage || DEFAULT_MESSAGE,
		userMessage: normalizeWhitespace(fallbackMessage) || DEFAULT_MESSAGE,
	};
};

export const SUCCESS_UPDATED_MSG = '更新が完了しました。';

export const showDemoWriteDisabled = (notify: (message: string) => void): void => {
	const demoEnabled = isDemoModeEnabled();
	const writeFallback = allowWriteFallback();

	if (!writeFallback) {
		notify('現在、この環境では書き込みが許可されていません。');
		return;
	}

	if (demoEnabled) {
		notify('デモモードでは書き込みは保存されません。');
	}
};

type NoticeHandler = ((message: string) => void) | null;

let registeredHandler: NoticeHandler = null;

export const registerNotifier = (handler: NoticeHandler): void => {
	registeredHandler = handler;
};

export const notify = (message: string): void => {
	if (typeof registeredHandler === 'function') {
		registeredHandler(message);
	}
};

export const getRegisteredNotifier = (): NoticeHandler => registeredHandler;
