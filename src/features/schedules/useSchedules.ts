import { useEffect, useMemo, useState } from 'react';
import { type SchedItem } from './data';
import { useSchedulesPort } from './data/context';

type Range = { from: string; to: string };

type UseSchedulesResult = {
  items: SchedItem[];
  loading: boolean;
};

const normalizeRange = (range: Range): Range => ({
  from: new Date(range.from).toISOString(),
  to: new Date(range.to).toISOString(),
});

export function useSchedules(range: Range): UseSchedulesResult {
  const [items, setItems] = useState<SchedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const port = useSchedulesPort();

    const normalizedRange = useMemo(() => normalizeRange(range), [range]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await port.list(normalizedRange);
        if (!alive) return;
        setItems(data);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
    }, [normalizedRange, port]);

  return { items, loading };
}

export const makeRange = (from: Date, to: Date): Range => ({
  from: from.toISOString(),
  to: to.toISOString(),
});
