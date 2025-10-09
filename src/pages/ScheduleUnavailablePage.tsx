import { Link } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const ScheduleUnavailablePage = () => (
  <main className="mx-auto max-w-3xl px-6 py-10">
    <Stack spacing={3}>
      <Typography component="h1" variant="h4" fontWeight={600}>
        スケジュール機能は利用できません
      </Typography>

      <Typography component="p" variant="body1">
        この環境ではスケジュール機能が無効化されています。機能を有効化するには、開発環境で
        <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-sm">VITE_FEATURE_SCHEDULES=1</code>
  を設定するか、ブラウザーのコンソールで
  <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-sm">{`localStorage.setItem("feature:schedules","1")`}</code>
        を実行してください。
      </Typography>

      <Alert severity="info" role="status">
        設定を変更したらページを再読み込みしてください。フラグが有効化されると、このページの代わりにスケジュール画面が表示されます。
      </Alert>

      <Stack direction="row" spacing={2}>
        <Button component={Link} to="/" variant="contained" color="primary">
          ホームへ戻る
        </Button>
        <Button
          component={Link}
          to="/records"
          variant="outlined"
        >
          記録一覧を開く
        </Button>
      </Stack>
    </Stack>
  </main>
);

export default ScheduleUnavailablePage;
