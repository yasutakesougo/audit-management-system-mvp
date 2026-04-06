import React from 'react';
import { getSpHealthSignal, subscribeSpHealthSignal, type SpHealthSignal } from '../spHealthSignalStore';

/**
 * useSpHealthSignal — 現在の SharePoint 健康シグナルを取得する React Hook
 * 
 * シグナルが変化（深刻化・解消・失効）した際に、自動で再レンダリングをトリガーします。
 */
export function useSpHealthSignal(): SpHealthSignal | null {
  const [signal, setSignal] = React.useState<SpHealthSignal | null>(() => getSpHealthSignal());

  React.useEffect(() => {
    // コンポーネントのマウント時に現在の最新値を取得
    setSignal(getSpHealthSignal());

    // シグナルストアの変更を購読
    const unsubscribe = subscribeSpHealthSignal((newSignal) => {
      setSignal(newSignal);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return signal;
}
