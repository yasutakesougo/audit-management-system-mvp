import { getEnv } from '@/lib/runtimeEnv';
import { IcebergPdcaPage } from '@/features/ibd/analysis/pdca/IcebergPdcaPage';

const Page = (): JSX.Element => {
  const writeEnabled = getEnv('VITE_WRITE_ENABLED') === '1';
  const debugEnabled = getEnv('VITE_AUDIT_DEBUG') === '1';
  if (debugEnabled) {
    console.log('[iceberg-pdca/pages] mounted', {
      writeEnabled,
      VITE_WRITE_ENABLED: getEnv('VITE_WRITE_ENABLED'),
    });
  }
  return <IcebergPdcaPage writeEnabled={writeEnabled} />;
};

export default Page;
