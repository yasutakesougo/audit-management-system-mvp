import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import * as React from 'react';
// MUI Icons
import { withAudit } from '@/lib/auditWrap';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import { pushAudit } from '../../lib/audit';
import { useChecklistApi } from './api';
import type { ChecklistInsertDTO, ChecklistItem } from './types';

export default function ChecklistPage() {
  const { list, add } = useChecklistApi();
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

  React.useEffect(() => {
    let alive = true;
    list()
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [list]); // listを依存に追加

  const onChange = (k: keyof ChecklistInsertDTO) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
  };

  async function onAdd() {
    setBusy(true);
    setError(null);
    try {
      const created = await withAudit({ baseAction: 'CREATE', entity: 'Compliance_CheckRules', before: { form } }, () => add(form));
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
    <Stack spacing={2} sx={{ p: 2 }}>
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

      <Stack spacing={1}>
        {items.length === 0 ? (
          <Typography color="text.secondary">データがありません</Typography>
        ) : (
          items.map(it => (
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
