import { getSharePointBaseUrl, shouldSkipSharePoint } from '@/lib/env';
import { useAuth } from '@/auth/useAuth';
import { useMemo } from 'react';
import { createSpClient } from '@/lib/spClient';

import { MeetingMinutesDetailPage } from './pages/MeetingMinutesDetailPage';
import { MeetingMinutesEditPage } from './pages/MeetingMinutesEditPage';
import { MeetingMinutesListPage } from './pages/MeetingMinutesListPage';
import { MeetingMinutesNewPage } from './pages/MeetingMinutesNewPage';
import { createLocalStorageMeetingMinutesRepository } from './sp/localStorageRepository';
import { createSharePointMeetingMinutesRepository } from './sp/sharepointRepository';

function useMeetingMinutesRepo() {
  const { acquireToken } = useAuth();
  return useMemo(() => {
    if (shouldSkipSharePoint()) return createLocalStorageMeetingMinutesRepository();
    const client = createSpClient(acquireToken, getSharePointBaseUrl());
    return createSharePointMeetingMinutesRepository(client.spFetch);
  }, [acquireToken]);
}

const ListRoute = () => {
  const repo = useMeetingMinutesRepo();
  return <MeetingMinutesListPage repo={repo} />;
};

const DetailRoute = () => {
  const repo = useMeetingMinutesRepo();
  return <MeetingMinutesDetailPage repo={repo} />;
};

const NewRoute = () => {
  const repo = useMeetingMinutesRepo();
  return <MeetingMinutesNewPage repo={repo} />;
};

const EditRoute = () => {
  const repo = useMeetingMinutesRepo();
  return <MeetingMinutesEditPage repo={repo} />;
};

export const MeetingMinutesRoutes = {
  List: <ListRoute />,
  Detail: <DetailRoute />,
  New: <NewRoute />,
  Edit: <EditRoute />,
};
