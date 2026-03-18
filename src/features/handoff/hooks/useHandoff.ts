import { useState, useCallback, useMemo } from "react";
import type { Handoff } from "@/domain/Handoff";
import type { CreateHandoffInput } from "@/domain/HandoffRepository";
import { createHandoffRepository } from "../repositories/createHandoffRepository";
import { useSP } from "@/lib/spClient";

export const useHandoff = () => {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const spClient = useSP();
  const repository = useMemo(() => createHandoffRepository(spClient), [spClient]);

  const loadHandoffsByDate = useCallback(
    async (targetDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await repository.getHandoffsByDate(targetDate);
        setHandoffs(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load handoffs"));
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [repository]
  );

  const loadHandoffsByUser = useCallback(
    async (userId: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await repository.getHandoffsByUser(userId);
        setHandoffs(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load handoffs"));
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [repository]
  );

  const createHandoff = useCallback(
    async (input: CreateHandoffInput) => {
      setLoading(true);
      setError(null);
      try {
        const newHandoff = await repository.createHandoff(input);
        // 作成したものをローカルステートにも反映させる
        setHandoffs((prev) => [...prev, newHandoff]);
        return newHandoff;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to create handoff"));
        console.error(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [repository]
  );

  const markHandoffAsRead = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await repository.updateHandoffStatus(id, "read");
        setHandoffs((prev) =>
          prev.map((h) => (h.id === id ? { ...h, status: "read" } : h))
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to update status"));
        console.error(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [repository]
  );

  return {
    handoffs,
    loading,
    error,
    loadHandoffsByDate,
    loadHandoffsByUser,
    createHandoff,
    markHandoffAsRead,
  };
};
