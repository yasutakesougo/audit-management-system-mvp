import React, { useCallback, useState } from 'react';
import { BTN_COPY } from './spDevPanelStyles';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button style={BTN_COPY} onClick={copy}>
      {copied ? '✅' : '📋'}
    </button>
  );
}
