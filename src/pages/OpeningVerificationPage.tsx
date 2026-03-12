/**
 * OpeningVerificationPage — A班 Day-2 開通確認コンソール
 *
 * Step1: checkAllLists()      → リスト存在確認
 * Step2: フィールド照合        → InternalName / FieldType / Required / Lookup 一致確認
 * Step3: SELECT検証           → FIELD_MAPから生成した$selectがテナントで通るか
 * Step4: CRUD テスト           → Read / Create / Update
 *
 * /admin/debug/opening-verification でアクセス
 */
import { WriteDisabledBanner } from '@/components/WriteDisabledBanner';
import { DAY0_REQUIRED_KEYS } from './opening-verification/constants';
import { btnStyle } from './opening-verification/helpers';
import { useOpeningVerification } from './opening-verification/useOpeningVerification';
import { Step1Results } from './opening-verification/components/Step1Results';
import { Step2Results } from './opening-verification/components/Step2Results';
import { Step3Results } from './opening-verification/components/Step3Results';
import { Step4Results } from './opening-verification/components/Step4Results';
import { LogConsole } from './opening-verification/components/LogConsole';

export default function OpeningVerificationPage() {
  const {
    healthResult, healthRunning,
    fieldResults, fieldRunning,
    selectResults, selectRunning,
    crudResults, crudRunning,
    logs,
    handleRunStep1, handleRunStep2, handleRunStep3, handleRunStep4,
    handleExport,
  } = useOpeningVerification();

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <WriteDisabledBanner />

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
        🏗️ A班 開通確認コンソール
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '14px' }}>
        Day-0 必須リスト {DAY0_REQUIRED_KEYS.length} 個に対するリスト存在確認 → フィールド照合 → CRUD検証
      </p>

      {/* ── Controls ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button style={btnStyle('#0066cc', healthRunning)} onClick={handleRunStep1} disabled={healthRunning}>
          {healthRunning ? '確認中...' : '📋 Step1: リスト存在確認'}
        </button>
        <button style={btnStyle('#6f42c1', fieldRunning)} onClick={handleRunStep2} disabled={fieldRunning}>
          {fieldRunning ? '照合中...' : '🔍 Step2: フィールド照合'}
        </button>
        <button style={btnStyle('#e67e22', selectRunning)} onClick={handleRunStep3} disabled={selectRunning}>
          {selectRunning ? '検証中...' : '📊 Step3: SELECT検証'}
        </button>
        <button style={btnStyle('#28a745', crudRunning)} onClick={handleRunStep4} disabled={crudRunning}>
          {crudRunning ? 'テスト中...' : '🧪 Step4: CRUD確認'}
        </button>
        <button style={btnStyle('#dc3545', false)} onClick={handleExport}>
          📥 レポート出力
        </button>
      </div>

      {/* ── Results ── */}
      {healthResult && <Step1Results result={healthResult} />}
      <Step2Results results={fieldResults} />
      <Step3Results results={selectResults} />
      <Step4Results results={crudResults} />

      {/* ── Log Console ── */}
      <LogConsole logs={logs} />
    </div>
  );
}
