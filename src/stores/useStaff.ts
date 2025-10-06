import type { Staff } from '@/types';

const EMPTY_STAFF: Staff[] = [];
const EMPTY_STAFF_MAP = new Map<number, Staff>();

const noopAsync = async () => {
	return;
};

export function useStaff() {
	const createStaff = async (_input: unknown): Promise<Staff> => {
		return {
			id: Date.now(),
			staffId: '',
			name: 'stub',
			certifications: [],
			workDays: [],
			baseWorkingDays: [],
		};
	};

	const updateStaff = async (_id: number | string, _input: unknown): Promise<Staff> => {
		return {
			id: Number(_id) || Date.now(),
			staffId: '',
			name: 'stub',
			certifications: [],
			workDays: [],
			baseWorkingDays: [],
		};
	};

	return {
		data: EMPTY_STAFF,
		loading: false,
		error: null as Error | null,
		reload: noopAsync,
		byId: EMPTY_STAFF_MAP,
		staff: EMPTY_STAFF,
		isLoading: false,
		load: noopAsync,
		createStaff,
		updateStaff,
	};
}
