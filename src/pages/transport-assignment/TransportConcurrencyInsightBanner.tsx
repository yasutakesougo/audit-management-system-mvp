import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Stack from '@mui/material/Stack';
import { useTransportConcurrencySignals } from '@/hooks/useNightlyDecision';

interface Props {
  currentVehicleId?: string;
}

export function TransportConcurrencyInsightBanner({ currentVehicleId }: Props) {
  const signals = useTransportConcurrencySignals();

  if (signals.length === 0) return null;

  // If currentVehicleId is provided, check if it's affected
  const relevantSignals = currentVehicleId
    ? signals.filter(s => s.affectedItems?.includes(currentVehicleId))
    : signals;

  if (relevantSignals.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {relevantSignals.map((signal, idx) => (
        <Alert 
          key={idx} 
          severity={signal.severity === 'critical' ? 'error' : 'warning'}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          <AlertTitle sx={{ fontWeight: 'bold' }}>
            {signal.severity === 'critical' ? '🔴 前日の送迎競合アラート' : '🟡 前日の送迎状況'}
          </AlertTitle>
          {currentVehicleId ? (
            <>
              車両「<strong>{currentVehicleId}</strong>」は昨日、編集の競合が多発しました。
              保存時の同時編集に十分注意してください。
            </>
          ) : (
            <>
              昨日は送迎配車全体で競合が発生していました。
              担当者間での連携を確認し、入力時間の重複に注意してください。
            </>
          )}
          <div style={{ marginTop: '4px', opacity: 0.9, fontSize: '0.85rem' }}>
            推奨アクション: {signal.recommendation}
          </div>
        </Alert>
      ))}
    </Stack>
  );
}
