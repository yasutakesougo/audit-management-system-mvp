/**
 * TelemetryDashboardPage — /admin/telemetry
 *
 * テレメトリの最小可視化ダッシュボード。
 * admin ロール限定。Firestore telemetry コレクションを直読みする。
 */
import TelemetryDashboard from '@/features/telemetry/components/TelemetryDashboard';

export default function TelemetryDashboardPage() {
  return <TelemetryDashboard />;
}
