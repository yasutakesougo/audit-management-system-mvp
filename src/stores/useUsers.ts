import type { User } from '@/types';

const EMPTY_USERS: User[] = [];
const EMPTY_USERS_MAP = new Map<number, User>();

const noopAsync = async () => {
	return;
};

export function useUsers() {
	return {
		data: EMPTY_USERS,
		loading: false,
		error: null as Error | null,
		reload: noopAsync,
		byId: EMPTY_USERS_MAP,
		users: EMPTY_USERS,
		isLoading: false,
		load: noopAsync,
	};
}
