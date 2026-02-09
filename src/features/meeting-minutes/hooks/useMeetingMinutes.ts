import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  MeetingMinutesRepository,
  MinutesSearchParams,
  MeetingMinutesCreateDto,
  MeetingMinutesUpdateDto,
} from '../sp/repository';

export const meetingMinutesQueryKeys = {
  list: (params: MinutesSearchParams) =>
    [
      'meetingMinutes',
      'list',
      params.q ?? '',
      params.tag ?? '',
      params.category ?? 'ALL',
      params.from ?? '',
      params.to ?? '',
      params.publishedOnly ? '1' : '0',
    ] as const,
  detail: (id: number) => ['meetingMinutes', 'detail', id] as const,
};

export const useMeetingMinutesList = (repo: MeetingMinutesRepository, params: MinutesSearchParams) =>
  useQuery({
    queryKey: meetingMinutesQueryKeys.list(params),
    queryFn: () => repo.list(params),
    staleTime: 30_000,
  });

export const useMeetingMinutesDetail = (repo: MeetingMinutesRepository, id: number) =>
  useQuery({
    queryKey: meetingMinutesQueryKeys.detail(id),
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => repo.getById(id),
    staleTime: 30_000,
  });

export const useCreateMeetingMinutes = (repo: MeetingMinutesRepository) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: MeetingMinutesCreateDto) => repo.create(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['meetingMinutes', 'list'] });
    },
  });
};

export const useUpdateMeetingMinutes = (repo: MeetingMinutesRepository) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: number; patch: MeetingMinutesUpdateDto }) =>
      repo.update(input.id, input.patch),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['meetingMinutes', 'list'] }),
        qc.invalidateQueries({ queryKey: meetingMinutesQueryKeys.detail(variables.id) }),
      ]);
    },
  });
};
