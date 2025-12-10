import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/sharepoint/fields';
import type { User } from '@/types';
import { useMemo } from 'react';

/**
 * IUserMaster (SharePoint) を User 型に変換
 */
const mapToUser = (userMaster: IUserMaster): User => {
	return {
		id: userMaster.Id,
		userId: userMaster.UserID || '',
		name: userMaster.FullName || '',
		furigana: userMaster.Furigana || undefined,
		nameKana: userMaster.FullNameKana || undefined,
		severe: userMaster.severeFlag || false,
		active: userMaster.IsActive !== false, // null/undefined → true
		toDays: userMaster.TransportToDays || [],
		fromDays: userMaster.TransportFromDays || [],
		attendanceDays: userMaster.AttendanceDays || [],
		certNumber: userMaster.RecipientCertNumber || undefined,
		certExpiry: userMaster.RecipientCertExpiry || undefined,
		serviceStartDate: userMaster.ServiceStartDate,
		serviceEndDate: userMaster.ServiceEndDate,
		contractDate: userMaster.ContractDate,
		highIntensitySupport: userMaster.IsHighIntensitySupportTarget || false,
		modified: userMaster.Modified || undefined,
		created: userMaster.Created || undefined,
	};
};

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
 * - useSchedules/useDaily形式への正規化
 * - IUserMaster → User 型変換
 */
export function useUsers() {
	const { data, status, error, refresh } = useUsersStore();

	const loading = status === 'idle' || status === 'loading';

	// IUserMaster[] → User[] 変換
	const userData = useMemo(() => {
		return data.map(mapToUser);
	}, [data]);

	const byId = useMemo(() => {
		const map = new Map<number, User>();
		userData.forEach((user) => {
			map.set(user.id, user);
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
