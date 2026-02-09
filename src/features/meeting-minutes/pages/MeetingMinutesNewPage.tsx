import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { MeetingMinutesRepository } from '../sp/repository';
import { useCreateMeetingMinutes } from '../hooks/useMeetingMinutes';
import { MeetingMinutesForm, createDefaultDraft } from '../components/MeetingMinutesForm';
import type { MeetingCategory } from '../types';

const isMeetingCategory = (value: string | null): value is MeetingCategory =>
  value === '職員会議' ||
  value === '朝会' ||
  value === '夕会' ||
  value === 'ケース会議' ||
  value === '委員会' ||
  value === 'その他';

export function MeetingMinutesNewPage(props: { repo: MeetingMinutesRepository }) {
  const { repo } = props;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const create = useCreateMeetingMinutes(repo);

  const [draft, setDraft] = React.useState(() => {
    const base = createDefaultDraft();
    const category = searchParams.get('category');
    if (!isMeetingCategory(category)) {
      return base;
    }
    return {
      ...base,
      category,
      title: `${category}_${base.meetingDate}`,
    };
  });

  return (
    <MeetingMinutesForm
      mode="new"
      value={draft}
      onChange={setDraft}
      isSaving={create.isPending}
      errorMessage={create.isError ? '作成に失敗しました。' : undefined}
      onCancel={() => nav(-1)}
      onSave={async () => {
        const id = await create.mutateAsync(draft);
        nav(`/meeting-minutes/${id}`);
      }}
    />
  );
}
