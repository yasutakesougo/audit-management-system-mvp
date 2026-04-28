import { IcebergPdcaPage } from '@/features/ibd/analysis/pdca/IcebergPdcaPage';
import { isDebugFlag } from '@/lib/debugFlag';
import { getEnv } from '@/lib/runtimeEnv';

const Page = (): JSX.Element => {
  const writeEnabled = getEnv('VITE_WRITE_ENABLED') === '1';
  const debugEnabled = isDebugFlag(getEnv('VITE_AUDIT_DEBUG'));
  if (debugEnabled) {
    // eslint-disable-next-line no-console
    console.log('[iceberg-pdca/pages] mounted', {
      writeEnabled,
      VITE_WRITE_ENABLED: getEnv('VITE_WRITE_ENABLED'),
    });
  }
  return <IcebergPdcaPage writeEnabled={writeEnabled} />;
};

export default Page;
