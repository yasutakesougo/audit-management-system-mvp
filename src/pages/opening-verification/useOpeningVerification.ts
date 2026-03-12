/**
 * useOpeningVerification — State & handlers for the verification console
 *
 * Encapsulates all 8 state variables + log buffer + step runners.
 * The page component only needs to render the returned state.
 */
import type { HealthCheckSummary } from '@/sharepoint/spListHealthCheck';
import { useCallback, useState } from 'react';
import type { CrudResult, FieldCheckResult, SelectCheckResult } from './types';
import { useFetcher } from './useFetcher';
import { runStep1 } from './steps/runStep1';
import { runStep2 } from './steps/runStep2';
import { runStep3 } from './steps/runStep3';
import { runStep4 } from './steps/runStep4';
import { exportMarkdown } from './helpers';

export function useOpeningVerification() {
  // Step1: List existence
  const [healthResult, setHealthResult] = useState<HealthCheckSummary | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);

  // Step2: Field check
  const [fieldResults, setFieldResults] = useState<FieldCheckResult[]>([]);
  const [fieldRunning, setFieldRunning] = useState(false);

  // Step3: SELECT query verification
  const [selectResults, setSelectResults] = useState<SelectCheckResult[]>([]);
  const [selectRunning, setSelectRunning] = useState(false);

  // Step4: CRUD
  const [crudResults, setCrudResults] = useState<CrudResult[]>([]);
  const [crudRunning, setCrudRunning] = useState(false);

  // Shared log
  const [logs, setLogs] = useState<string[]>([]);
  const appendLog = useCallback(
    (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`]),
    [],
  );

  const { getFetcher } = useFetcher();

  // ── Step handlers ──

  const handleRunStep1 = useCallback(async () => {
    setHealthRunning(true);
    setHealthResult(null);
    try {
      const fetcher = await getFetcher();
      const result = await runStep1(fetcher, appendLog);
      setHealthResult(result);
    } catch (err) {
      appendLog(`❌ Step1エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setHealthRunning(false);
    }
  }, [getFetcher, appendLog]);

  const handleRunStep2 = useCallback(async () => {
    setFieldRunning(true);
    setFieldResults([]);
    try {
      const fetcher = await getFetcher();
      const results = await runStep2(fetcher, appendLog);
      setFieldResults(results);
    } catch (err) {
      appendLog(`❌ Step2エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFieldRunning(false);
    }
  }, [getFetcher, appendLog]);

  const handleRunStep3 = useCallback(async () => {
    setSelectRunning(true);
    setSelectResults([]);
    try {
      const fetcher = await getFetcher();
      const results = await runStep3(fetcher, appendLog);
      setSelectResults(results);
    } catch (err) {
      appendLog(`❌ Step3エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSelectRunning(false);
    }
  }, [getFetcher, appendLog]);

  const handleRunStep4 = useCallback(async () => {
    setCrudRunning(true);
    setCrudResults([]);
    try {
      const fetcher = await getFetcher();
      const results = await runStep4(fetcher, appendLog);
      setCrudResults(results);
    } catch (err) {
      appendLog(`❌ Step4エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCrudRunning(false);
    }
  }, [getFetcher, appendLog]);

  const handleExport = useCallback(() => {
    exportMarkdown(healthResult, fieldResults, selectResults, crudResults, appendLog);
  }, [healthResult, fieldResults, selectResults, crudResults, appendLog]);

  return {
    // State
    healthResult,
    healthRunning,
    fieldResults,
    fieldRunning,
    selectResults,
    selectRunning,
    crudResults,
    crudRunning,
    logs,
    // Handlers
    handleRunStep1,
    handleRunStep2,
    handleRunStep3,
    handleRunStep4,
    handleExport,
  } as const;
}
