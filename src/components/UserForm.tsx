import { useUsers } from '@/hooks/useUsers';
import type { SpUserItem, UserUpsert } from '@/types';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export type UserFormMode = 'create' | 'edit';

type UserFormInitial = {
  id?: number;
  Title?: string | null;
  Furigana?: string | null;
  Phone?: string | null;
  Email?: string | null;
  IsActive?: boolean | null;
};

type UserFormProps = {
  mode: UserFormMode;
  initial?: UserFormInitial;
  onDone?: (result: SpUserItem) => void;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserForm({ mode, initial, onDone }: UserFormProps) {
  const { createUser, updateUser } = useUsers();
  const [title, setTitle] = useState<string>(initial?.Title ?? '');
  const [furigana, setFurigana] = useState<string>(initial?.Furigana ?? '');
  const [phone, setPhone] = useState<string>(initial?.Phone ?? '');
  const [email, setEmail] = useState<string>(initial?.Email ?? '');
  const [isActive, setIsActive] = useState<boolean>(initial?.IsActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // initial が変更されたときにフォームを更新（一覧から別ユーザーに切り替える場合など）
  useEffect(() => {
    setTitle(initial?.Title ?? '');
    setFurigana(initial?.Furigana ?? '');
    setPhone(initial?.Phone ?? '');
    setEmail(initial?.Email ?? '');
    setIsActive(initial?.IsActive ?? true);
    setError(null);
    setSuccess(null);
  }, [initial]);

  const submitLabel = useMemo(() => (mode === 'create' ? '作成' : '更新'), [mode]);

  // エラークリア機能付きのハンドラー
  const handleTitleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
    if (error) setError(null);
  }, [error]);

  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    if (error) setError(null);
  }, [error]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('氏名 (Title) は必須です');
      return;
    }
    if (email && !emailPattern.test(email.trim())) {
      setError('メールアドレスの形式が不正です');
      return;
    }

    // 編集モードでIDが無い場合の明示的なエラー
    if (mode === 'edit' && !initial?.id) {
      setError('編集対象の利用者IDが取得できませんでした');
      return;
    }

    const payload: UserUpsert = {
      Title: title.trim(),
      Furigana: furigana.trim() || null,
      Phone: phone.trim() || null,
      Email: email.trim() || null,
      IsActive: isActive,
    };

    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const result = mode === 'create'
        ? await createUser(payload)
        : await updateUser(initial!.id!, payload);
      setSuccess('保存しました');
      onDone?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存時にエラーが発生しました';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [createUser, email, furigana, initial?.id, isActive, mode, onDone, phone, title, updateUser]);

  return (
    <form className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-md bg-white p-4 shadow" noValidate onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">利用者{mode === 'create' ? 'の作成' : 'の編集'}</h2>
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{success}</div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">氏名 (Title)</span>
        <input
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={title}
          onChange={handleTitleChange}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">ふりがな</span>
        <input
          className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={furigana}
          onChange={(event) => setFurigana(event.target.value)}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">電話番号</span>
          <input
            className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">メールアドレス</span>
          <input
            className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={email}
            onChange={handleEmailChange}
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        在籍中
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
          disabled={busy}
        >
          {busy ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
