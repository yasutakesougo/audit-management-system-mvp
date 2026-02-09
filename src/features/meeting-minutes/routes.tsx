import * as React from 'react';
import { getSharePointBaseUrl } from '@/lib/env';

import { createSharePointMeetingMinutesRepository } from './sp/sharepointRepository';
import { MeetingMinutesListPage } from './pages/MeetingMinutesListPage';
import { MeetingMinutesDetailPage } from './pages/MeetingMinutesDetailPage';
import { MeetingMinutesNewPage } from './pages/MeetingMinutesNewPage';
import { MeetingMinutesEditPage } from './pages/MeetingMinutesEditPage';

const repo = createSharePointMeetingMinutesRepository(getSharePointBaseUrl());

export const MeetingMinutesRoutes = {
  List: <MeetingMinutesListPage repo={repo} />,
  Detail: <MeetingMinutesDetailPage repo={repo} />,
  New: <MeetingMinutesNewPage repo={repo} />,
  Edit: <MeetingMinutesEditPage repo={repo} />,
};
