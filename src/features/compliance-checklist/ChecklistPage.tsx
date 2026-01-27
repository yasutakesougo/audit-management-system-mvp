import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// MUI Icons
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import { pushAudit } from '../../lib/audit';
import { useChecklistApi } from './api';
import type { ChecklistInsertDTO, ChecklistItem } from './types';

export default function ChecklistPage() {
  const { list, add } = useChecklistApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = React.useState<ChecklistItem[]>([]);
  const [form, setForm] = React.useState<ChecklistInsertDTO>({
    Title: '',
    RuleID: '',
    RuleName: '',
    EvaluationLogic: '',
    SeverityLevel: 'INFO',
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // RuleID filter from query params
  const ruleIdFilter = React.useMemo(() => {
    const q = new URLSearchParams(location.search);
    return (q.get('ruleId') ?? '').trim();
  }, [location.search]);

  // Filtered items based on ruleId query param
  const visibleItems = React.useMemo(() => {
    if (!ruleIdFilter) return items;
    return items.filter(item => String(item.value ?? '').trim() === ruleIdFilter);
  }, [items, ruleIdFilter]);

  React.useEffect(() => {
    let alive = true;
    list()
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, []); // 依存配列を空にして、初回のみ実行されるようにする

  const onChange = (k: keyof ChecklistInsertDTO) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
  };

  async function onAdd() {
    setBusy(true);
    setError(null);
    try {
      const created = await add(form);
      setItems(prev => [created, ...prev]);
      pushAudit({
        actor: 'current',
        action: 'checklist.create',
        entity: 'Compliance_CheckRules',
        entity_id: created.id,
        channel: 'UI',
        after: { item: created },
      });
      setForm({ Title: '', RuleID: '', RuleName: '', EvaluationLogic: '', SeverityLevel: 'INFO' });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }} data-testid="checklist-root">
      <Stack direction="row" alignItems="center" spacing={1}>
        <AssignmentTurnedInRoundedIcon color="primary" />
        <Typography variant="h5" component="h1">監査チェックリスト</Typography>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="タイトル"
            value={form.Title}
            onChange={onChange('Title')}
            inputProps={{ 'aria-label': 'タイトル' }}
          />
          <TextField
            label="ルールID"
            value={form.RuleID}
            onChange={onChange('RuleID')}
            inputProps={{ 'aria-label': 'ルールID' }}
            required
          />
          <TextField
            label="ルール名"
            value={form.RuleName}
            onChange={onChange('RuleName')}
            inputProps={{ 'aria-label': 'ルール名' }}
            required
          />
          <TextField
            label="評価ロジック"
            value={form.EvaluationLogic ?? ''}
            onChange={onChange('EvaluationLogic')}
            inputProps={{ 'aria-label': '評価ロジック' }}
            multiline
            rows={3}
          />
          <Button
            variant="contained"
            startIcon={<AddTaskRoundedIcon />}
            onClick={onAdd}
            disabled={busy || !form.Title || !form.RuleID || !form.RuleName}
            sx={{ minHeight: 44, minWidth: 120 }}
          >
            {busy ? '追加中…' : '追加'}
          </Button>
        </Stack>
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </Paper>

      {ruleIdFilter && (
        <Alert
          severity="info"
          action={
            <Button
              size="small"
              onClick={() => navigate('/checklist', { replace: true })}
            >
              フィルタ解除
            </Button>
          }
        >
          RuleID: <strong>{ruleIdFilter}</strong> のみ表示中
        </Alert>
      )}

      <Stack spacing={1}>
        {visibleItems.length === 0 ? (
          <Typography color="text.secondary">
            {ruleIdFilter ? `RuleID "${ruleIdFilter}" に一致するデータがありません` : 'データがありません'}
          </Typography>
        ) : (
          visibleItems.map(it => (
            <Paper key={it.id} sx={{ p: 1.5 }}>
              <Typography fontWeight={600}>{it.label}</Typography>
              <Box sx={{ fontSize: 14, color: 'text.secondary' }}>
                <div>値: {it.value ?? '—'}</div>
                <div>備考: {it.note ?? '—'}</div>
              </Box>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
