import * as React from 'react';
import { Box, Stack, TextField, Button, Typography, Paper } from '@mui/material';
import { useChecklistApi } from './api';
import type { ChecklistItem, ChecklistInsertDTO } from './types';
import { pushAudit } from '../../lib/audit';

export default function ChecklistPage() {
  const { list, add } = useChecklistApi();
  const [items, setItems] = React.useState<ChecklistItem[]>([]);
  const [form, setForm] = React.useState<ChecklistInsertDTO>({
    Title: '',
    cr013_key: '',
    cr013_value: '',
    cr013_note: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    list()
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [list]);

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
        entity: 'Compliance_Checklist',
        entity_id: created.id,
        channel: 'UI',
        after: { item: created },
      });
      setForm({ Title: '', cr013_key: '', cr013_value: '', cr013_note: '' });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h5" component="h1">監査チェックリスト</Typography>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="項目名(Title)"
            value={form.Title}
            onChange={onChange('Title')}
            inputProps={{ 'aria-label': '項目名' }}
          />
          <TextField
            label="キー(cr013_key)"
            value={form.cr013_key}
            onChange={onChange('cr013_key')}
            inputProps={{ 'aria-label': 'キー' }}
          />
          <TextField
            label="値(cr013_value)"
            value={form.cr013_value ?? ''}
            onChange={onChange('cr013_value')}
            inputProps={{ 'aria-label': '値' }}
          />
          <TextField
            label="備考(cr013_note)"
            value={form.cr013_note ?? ''}
            onChange={onChange('cr013_note')}
            inputProps={{ 'aria-label': '備考' }}
          />
          <Button
            variant="contained"
            onClick={onAdd}
            disabled={busy || !form.Title || !form.cr013_key}
            sx={{ minHeight: 44 }}
          >
            追加
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
