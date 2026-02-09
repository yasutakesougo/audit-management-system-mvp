import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

import type { MeetingMinutesRepository } from '../sp/repository';
import { useMeetingMinutesDetail, useUpdateMeetingMinutes } from '../hooks/useMeetingMinutes';
import { MeetingMinutesForm } from '../components/MeetingMinutesForm';
import type { MeetingMinutesDraft } from '../components/MeetingMinutesForm';

export function MeetingMinutesEditPage(props: { repo: MeetingMinutesRepository }) {
  const { repo } = props;
  const nav = useNavigate();
  const idParam = useParams().id;
  const id = Number(idParam);

  const q = useMeetingMinutesDetail(repo, id);
  const upd = useUpdateMeetingMinutes(repo);

  const [draft, setDraft] = React.useState<MeetingMinutesDraft | null>(null);

  React.useEffect(() => {
    if (q.data && !draft) {
      const m = q.data;
      setDraft({
        title: m.title,
        meetingDate: m.meetingDate,
        category: m.category,
        summary: m.summary,
        decisions: m.decisions,
        actions: m.actions,
        tags: m.tags,
        relatedLinks: m.relatedLinks,
        chair: m.chair ?? '',
        scribe: m.scribe ?? '',
        attendees: m.attendees ?? [],
        isPublished: m.isPublished ?? true,
        created: m.created,
        modified: m.modified,
      });
    }
  }, [q.data, draft]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">IDが不正です。</Typography>
      </Box>
    );
  }

  if (q.isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>読み込み中…</Typography>
      </Box>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">取得に失敗しました。</Typography>
      </Box>
    );
  }

  if (!draft) return null;

  return (
    <MeetingMinutesForm
      mode="edit"
      value={draft}
      onChange={setDraft}
      isSaving={upd.isPending}
      errorMessage={upd.isError ? '更新に失敗しました。' : undefined}
      onCancel={() => nav(-1)}
      onSave={async () => {
        await upd.mutateAsync({ id, patch: draft });
        nav(`/meeting-minutes/${id}`);
      }}
    />
  );
}
