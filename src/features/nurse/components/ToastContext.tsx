import React, { createContext, useContext } from 'react';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';
export type ToastFn = (message: string, severity?: ToastSeverity) => void;

type ToastContextValue = {
  show: ToastFn;
};

const ToastContext = createContext<ToastContextValue>({
  show: () => undefined,
});

export const useToast = (): ToastContextValue => useContext(ToastContext);

export function ToastProvider({ children, notify }: { children: React.ReactNode; notify?: ToastFn }) {
  const handler: ToastFn = notify ?? ((message, severity = 'info') => {
    console.log(`[toast:${severity}]`, message);
  });

  return <ToastContext.Provider value={{ show: handler }}>{children}</ToastContext.Provider>;
}
