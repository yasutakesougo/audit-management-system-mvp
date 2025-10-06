import { useCallback, useEffect, useState } from "react";
import type { UseSP } from "@/lib/spClient";

export async function ensureOperationHubLists(_sp?: UseSP): Promise<void> {
  // placeholder implementation for MVP
  return;
}

export function useEnsureOperationHubLists(sp?: UseSP) {
  const [ensuring, setEnsuring] = useState(false);

  useEffect(() => {
    if (!sp) return;
    void ensureOperationHubLists(sp);
  }, [sp]);

  const ensure = useCallback(async () => {
    if (ensuring) return;
    setEnsuring(true);
    try {
      await ensureOperationHubLists(sp);
    } finally {
      setEnsuring(false);
    }
  }, [ensuring, sp]);

  return { ensuring, ensure };
}
