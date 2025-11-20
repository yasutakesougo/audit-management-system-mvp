import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

const ScheduleUnavailablePage = () => (
  <main
    className="mx-auto max-w-3xl px-6 py-10"
    data-testid="schedule-unavailable-page"
  >
    <Stack spacing={3}>
      <Typography component="h1" variant="h4" fontWeight={600}>
        スケジュール機能は利用できません
      </Typography>

      {/* 一般利用者向けの説明 */}
      <Typography component="p" variant="body1">
        現在、この環境ではスケジュール機能が無効化されているため、予定の確認・登録は行えません。
        必要な場合は、管理者またはシステム担当者にお問い合わせください。
      </Typography>

      {/* 開発者／検証者向けの案内（技術情報） - 開発環境でのみ表示 */}
      {import.meta.env.DEV && (
        <Alert severity="info" role="status" data-testid="dev-instructions">
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            開発・検証用メモ
          </Typography>
          <Typography variant="body2" component="p">
            スケジュール機能を有効化するには、開発環境で
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-sm">
              VITE_FEATURE_SCHEDULES=1
            </code>
            を設定するか、ブラウザーのコンソールで
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-sm">
              {`localStorage.setItem("feature:schedules","1")`}
            </code>
            を実行してください。設定後にページを再読み込みすると、スケジュール画面が表示されます。
          </Typography>
        </Alert>
      )}

      <Stack direction="row" spacing={2}>
        <Button component={Link} to="/" variant="contained" color="primary">
          ホームへ戻る
        </Button>
        <Button
          component={Link}
          to="/records"
          variant="outlined"
          aria-label="黒ノート（月次・日次記録の画面）を開く"
        >
          黒ノートを開く
        </Button>
      </Stack>
    </Stack>
  </main>
);

export default ScheduleUnavailablePage;
