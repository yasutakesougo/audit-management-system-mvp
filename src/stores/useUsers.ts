import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/sharepoint/fields';
import { useMemo } from 'react';

export type StoreUser = IUserMaster;

/**
 * useUsers - Zustand useUsersStore への薄いラッパー
 *
 * 既存の useUsers() 呼び出し元との互換性を保ちながら、
 * 内部的には useUsersStore に委譲する設計。
 *
 * useUsersStore の責務:
 * - SharePoint本番データ / DEMOデータ / テスト時の切り替え
 * - データ取得・更新ロジック
 * - Zustand状態管理
 *
 * この薄ラッパーの責務:
 * - 既存API互換性（data, loading, error, reload, byId）
 * - 既存API互換性（data/users/loading/error/reload/byId）
 * - データは IUserMaster (Domain SSOT) をそのまま返す
 */
export function useUsers() {
	const { data, status, error, refresh } = useUsersStore();

	const loading = status === 'idle' || status === 'loading';

	const userData = data;

	const byId = useMemo(() => {
		const map = new Map<number, StoreUser>();
		userData.forEach((user) => {
			map.set(user.Id, user);
		});
		return map;
	}, [userData]);

	const reload = async () => {
		await refresh();
	};

	return {
		data: userData,
		users: userData,              // 既存呼び出し元用のエイリアス
		loading,
		isLoading: loading,           // useSchedules/useDaily互換
		error: (error as Error) ?? null,
		reload,
		load: reload,                 // useSchedules/useDaily互換
		byId,
	};
}
