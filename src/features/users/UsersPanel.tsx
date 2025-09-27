import { useCallback, useMemo, useState } from 'react';
import { useUsers } from './useUsers';
import type { IUserMasterCreateDto } from './types';
import Loading from '../../ui/components/Loading';
import ErrorState from '../../ui/components/ErrorState';
import { AuthRequiredError } from '../../lib/errors';
import { FormField } from '../../ui/components/FormField';

export default function UsersPanel() {
  const { data, status, create, update, remove, refresh, error } = useUsers();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const canCreate = useMemo(
    () => !!userId.trim() && !!fullName.trim() && busyId === null,
    [userId, fullName, busyId]
  );

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const payload: IUserMasterCreateDto = {
      UserID: userId.trim(),
      FullName: fullName.trim(),
      IsHighIntensitySupportTarget: false,
    };
    setBusyId(-1);
    try {
      await create(payload);
      setUserId('');
      setFullName('');
    } finally {
      setBusyId(null);
    }
  }, [canCreate, create, fullName, userId]);

  const handleRename = useCallback(async (id: number | string, currentName: string) => {
    const next = `${currentName} *`;
    setBusyId(Number(id));
    try {
      await update(id, { FullName: next });
    } finally {
      setBusyId(null);
    }
  }, [update]);

  const handleDelete = useCallback(async (id: number | string) => {
    if (!window.confirm('Delete this user?')) return;
    setBusyId(Number(id));
    try {
      await remove(id);
    } finally {
      setBusyId(null);
    }
  }, [remove]);

  const handleRefresh = useCallback(async () => {
    if (busyId !== null) return;
    setBusyId(-2);
    try {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [busyId, refresh]);

  const onCreateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleCreate();
  }, [handleCreate]);

  if (status === 'loading' && !data.length) {
    return <Loading />;
  }

  if (status === 'error' && error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof AuthRequiredError || errMessage === 'AUTH_REQUIRED') {
      return (
        <ErrorState message="サインインが必要です。上部の「Sign in」を押して認証を完了してください。" />
      );
    }
    return <ErrorState message={errMessage} />;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Users</h2>

      <div className="flex flex-wrap gap-4 items-end" aria-label="User creation form">
        <FormField label="User ID" required className="min-w-[180px]" labelClassName="text-xs">
          {(id) => (
            <input
              id={id}
              className="border p-2"
              aria-label="User ID"
              placeholder="ユーザーID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={onCreateKeyDown}
              required
            />
          )}
        </FormField>
        <FormField label="氏名" required className="min-w-[180px]" labelClassName="text-xs">
          {(id) => (
            <input
              id={id}
              className="border p-2"
              aria-label="氏名"
              placeholder="氏名"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={onCreateKeyDown}
              required
            />
          )}
        </FormField>
        <button
          className="border px-3 py-2 bg-blue-600 text-white disabled:opacity-60"
          onClick={handleCreate}
          disabled={!canCreate}
        >
          {busyId === -1 ? 'Creating…' : 'Create'}
        </button>
        <button
          className="border px-3 py-2 disabled:opacity-60"
          onClick={handleRefresh}
          disabled={busyId !== null}
        >
          {busyId === -2 ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="text-sm text-gray-500">status: {status}</div>

      <div className="overflow-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">ID</th>
              <th className="border px-2 py-1 text-left">UserID</th>
              <th className="border px-2 py-1 text-left">FullName</th>
              <th className="border px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => {
              const rowBusy = busyId === Number(u.Id);
              return (
                <tr key={u.Id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-2 py-1">{u.Id}</td>
                <td className="border px-2 py-1">{u.UserID}</td>
                <td className="border px-2 py-1">{u.FullName}</td>
                <td className="border px-2 py-1 space-x-2">
                  <button
                    className="underline text-blue-600 disabled:text-gray-400"
                    onClick={() => handleRename(u.Id, u.FullName)}
                    disabled={rowBusy}
                  >
                    {rowBusy ? 'Renaming…' : 'Rename*'}
                  </button>
                  <button
                    className="underline text-red-600 disabled:text-gray-400"
                    onClick={() => handleDelete(u.Id)}
                    disabled={rowBusy}
                  >
                    {rowBusy ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td className="border px-2 py-4 text-center text-gray-400" colSpan={4}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
