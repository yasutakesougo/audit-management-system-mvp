import type { UseSP } from "@/lib/spClient";
import { useCallback, useEffect, useRef, useState } from "react";

export async function ensureOperationHubLists(_sp?: UseSP): Promise<void> {
  // placeholder implementation for MVP
  return;
}

export function useEnsureOperationHubLists(sp?: UseSP) {
  const [ensuring, setEnsuring] = useState(false);
  const spRef = useRef(sp);
  spRef.current = sp;

  useEffect(() => {
    if (!sp) return;
    void ensureOperationHubLists(sp);
  }, []);

  const ensure = useCallback(async () => {
    if (ensuring) return;
    setEnsuring(true);
    try {
      await ensureOperationHubLists(spRef.current);
    } finally {
      setEnsuring(false);
    }
  }, [ensuring]);

  return { ensuring, ensure };
}
