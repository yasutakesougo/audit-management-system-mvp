import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TESTIDS } from '../testing/testids';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

type Toast = {
	id: string;
	kind: ToastKind;
	message: string;
};

type ToastContextValue = {
	show: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const createToastId = () => {
	try {
		const crypto = globalThis.crypto;
		if (crypto && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
	} catch {
		// ignore access errors (e.g. unsupported environments)
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [items, setItems] = useState<Toast[]>([]);

	const show = useCallback((kind: ToastKind, message: string) => {
		const id = createToastId();
		setItems((prev) => [...prev, { id, kind, message }]);
		window.setTimeout(() => {
			setItems((prev) => prev.filter((toast) => toast.id !== id));
		}, 3000);
	}, []);

	const value = useMemo(() => ({ show }), [show]);

	return React.createElement(
		ToastContext.Provider,
		{ value },
		children,
		React.createElement(
			'div',
			{
				'aria-live': 'polite',
				role: 'status',
				'aria-atomic': 'true',
				className: 'fixed bottom-4 right-4 z-50 space-y-2',
				'data-testid': TESTIDS.supportProcedures.toast.root,
			},
			items.map((toast) =>
				React.createElement(
					'div',
					{
						key: toast.id,
						'data-testid': TESTIDS.supportProcedures.toast.message,
						className: `rounded px-3 py-2 text-sm font-medium text-white shadow transition-opacity duration-200 ${
							toast.kind === 'success'
								? 'bg-green-600'
								: toast.kind === 'error'
									? 'bg-red-600'
									: toast.kind === 'warning'
										? 'bg-amber-600'
										: 'bg-slate-800'
						}`,
					},
					React.createElement('span', {
						'data-testid': toast.kind === 'success'
							? TESTIDS.supportProcedures.toast.success
							: toast.kind === 'error'
								? TESTIDS.supportProcedures.toast.error
								: undefined,
						style: { marginRight: 8, display: toast.kind === 'success' || toast.kind === 'error' ? 'inline' : 'none' },
					}),
					toast.message,
				),
			),
		),
	);
};

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a <ToastProvider>');
	}
	return context;
};
