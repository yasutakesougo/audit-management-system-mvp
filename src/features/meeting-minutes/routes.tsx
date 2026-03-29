import { useMemo } from 'react';

import { MeetingMinutesDetailPage } from './pages/MeetingMinutesDetailPage';
import { MeetingMinutesEditPage } from './pages/MeetingMinutesEditPage';
import { MeetingMinutesListPage } from './pages/MeetingMinutesListPage';
import { MeetingMinutesNewPage } from './pages/MeetingMinutesNewPage';

import { useDataProvider } from '@/lib/data/useDataProvider';
import { DataProviderMeetingMinutesRepository } from './infra/DataProviderMeetingMinutesRepository';

function useMeetingMinutesRepo() {
  const { provider } = useDataProvider();
  return useMemo(() => {
    return new DataProviderMeetingMinutesRepository(provider);
  }, [provider]);
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
