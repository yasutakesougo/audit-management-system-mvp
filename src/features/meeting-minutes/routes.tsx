import { getSharePointBaseUrl, shouldSkipSharePoint } from '@/lib/env';

import { MeetingMinutesDetailPage } from './pages/MeetingMinutesDetailPage';
import { MeetingMinutesEditPage } from './pages/MeetingMinutesEditPage';
import { MeetingMinutesListPage } from './pages/MeetingMinutesListPage';
import { MeetingMinutesNewPage } from './pages/MeetingMinutesNewPage';
import { createLocalStorageMeetingMinutesRepository } from './sp/localStorageRepository';
import { createSharePointMeetingMinutesRepository } from './sp/sharepointRepository';

const repo = shouldSkipSharePoint()
  ? createLocalStorageMeetingMinutesRepository()
  : createSharePointMeetingMinutesRepository(getSharePointBaseUrl());

export const MeetingMinutesRoutes = {
  List: <MeetingMinutesListPage repo={repo} />,
  Detail: <MeetingMinutesDetailPage repo={repo} />,
  New: <MeetingMinutesNewPage repo={repo} />,
  Edit: <MeetingMinutesEditPage repo={repo} />,
};
