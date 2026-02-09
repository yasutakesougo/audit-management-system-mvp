import * as React from 'react';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';

import type { MeetingCategory, MeetingMinutes } from '../types';

const CATEGORIES: MeetingCategory[] = ['職員会議', '朝会', '夕会', 'ケース会議', '委員会', 'その他'];

export type MeetingMinutesDraft = Omit<MeetingMinutes, 'id'>;

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createDefaultDraft(): MeetingMinutesDraft {
  const date = todayISODate();
  return {
    title: `職員会議_${date}`,
    meetingDate: date,
    category: '職員会議',
    summary: '',
    decisions: '',
    actions: '',
    tags: '',
    relatedLinks: '',
    chair: '',
    scribe: '',
    attendees: [],
    isPublished: true,
    created: undefined,
    modified: undefined,
  };
}

export function MeetingMinutesForm(props: {
  mode: 'new' | 'edit';
  value: MeetingMinutesDraft;
  onChange: (next: MeetingMinutesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  errorMessage?: string;
}) {
  const { mode, value, onChange, onSave, onCancel, isSaving, errorMessage } = props;

  const set = <K extends keyof MeetingMinutesDraft>(key: K, v: MeetingMinutesDraft[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5">{mode === 'new' ? '議事録 作成' : '議事録 編集'}</Typography>

        {errorMessage && <Typography color="error">{errorMessage}</Typography>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="タイトル"
            value={value.title}
            onChange={(e) => set('title', e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="日付"
            type="date"
            value={value.meetingDate}
            onChange={(e) => set('meetingDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="カテゴリ"
            select
            value={value.category}
            onChange={(e) => set('category', e.target.value as MeetingCategory)}
            sx={{ minWidth: 180 }}
          >
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="司会（任意）"
            value={value.chair ?? ''}
            onChange={(e) => set('chair', e.target.value)}
            fullWidth
          />
          <TextField
            label="書記（任意）"
            value={value.scribe ?? ''}
            onChange={(e) => set('scribe', e.target.value)}
            fullWidth
          />
        </Stack>

        <TextField
          label="要点（Summary）"
          value={value.summary}
          onChange={(e) => set('summary', e.target.value)}
          fullWidth
          multiline
          minRows={4}
          placeholder="会議の要点を短く。後で検索される“主役”です。"
        />

        <TextField
          label="決定事項（Decisions）"
          value={value.decisions}
          onChange={(e) => set('decisions', e.target.value)}
          fullWidth
          multiline
          minRows={4}
          placeholder="例）・○○を来週から開始する\n・△△は中止する"
        />

        <TextField
          label="アクション（Actions）"
          value={value.actions}
          onChange={(e) => set('actions', e.target.value)}
          fullWidth
          multiline
          minRows={4}
          placeholder="例）・担当：山田 / 期限：2/20 / 内容：…"
        />

        <TextField
          label="タグ（半角/全角スペース区切り）"
          value={value.tags}
          onChange={(e) => set('tags', e.target.value)}
          fullWidth
          placeholder="例）送迎 ヒヤリ 虐待防止"
        />

        <TextField
          label="関連リンク（URLやパスを複数行で）"
          value={value.relatedLinks}
          onChange={(e) => set('relatedLinks', e.target.value)}
          fullWidth
          multiline
          minRows={2}
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onCancel} disabled={!!isSaving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={!!isSaving || !value.title || !value.meetingDate}
          >
            {isSaving ? '保存中…' : '保存'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
