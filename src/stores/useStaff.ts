import type { Staff } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

const now = new Date();
const delay = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanitizeOverrides = <T extends Record<string, unknown>>(input: Partial<T>): Partial<T> =>
	Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;

const makeStaff = (id: number, rawOverrides: Partial<Staff>): Staff => {
	const overrides = sanitizeOverrides<Staff>(rawOverrides);
	const baseStaff: Staff = {
		id,
		staffId: `STF${String(id).padStart(3, '0')}`,
		name: `職員 ${id}`,
		furigana: `しょくいん${id}`,
		nameKana: `ショクイン${id}`,
		jobTitle: '支援員',
		employmentType: '正社員',
		rbacRole: 'staff',
		email: `staff${id}@example.com`,
		phone: `090-0000-${String(id).padStart(4, '0')}`,
		role: '支援員',
		department: '日中活動部',
		active: true,
		hireDate: '2023-04-01',
		resignDate: undefined,
		certifications: ['社会福祉士', '精神保健福祉士'],
		workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		baseShiftStartTime: '09:00',
		baseShiftEndTime: '17:00',
		baseWorkingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		modified: now.toISOString(),
		created: now.toISOString(),
	};

	return {
		...baseStaff,
		...overrides,
	};
};

const DEMO_STAFF: Staff[] = [
	makeStaff(1, {
		name: '佐藤 花子',
		furigana: 'さとうはなこ',
		nameKana: 'サトウハナコ',
		jobTitle: '主任支援員',
		certifications: ['社会福祉士', '精神保健福祉士', 'ヘルパー2級'],
		department: '日中活動部',
	}),
	makeStaff(2, {
		name: '鈴木 次郎',
		furigana: 'すずきじろう',
		nameKana: 'スズキジロウ',
		jobTitle: '支援員',
		certifications: ['ヘルパー2級'],
		department: 'ショートステイ部',
	}),
	makeStaff(3, {
		name: '高橋 三郎',
		furigana: 'たかはしさぶろう',
		nameKana: 'タカハシサブロウ',
		jobTitle: '看護師',
		certifications: ['正看護師'],
		department: '医療部',
		workDays: ['monday', 'wednesday', 'friday'],
		baseWorkingDays: ['monday', 'wednesday', 'friday'],
	}),
];

const fetchDemoStaff = async (): Promise<Staff[]> => {
	await delay();
	return DEMO_STAFF.map((item) => ({ ...item }));
};

export function useStaff() {
	const [data, setData] = useState<Staff[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);

	const reload = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const next = await fetchDemoStaff();
			setData(next);
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const byId = useMemo(
		() => new Map<number, Staff>(data.map((item) => [item.id, item])),
		[data]
	);

	const createStaff = useCallback(async (input: Partial<Staff>): Promise<Staff> => {
		try {
			const newId = Math.max(0, ...data.map(item => item.id)) + 1;
			const newStaff = makeStaff(newId, input);
			await delay(100); // Simulate API delay
			setData(prev => [...prev, newStaff]);
			return newStaff;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			throw error;
		}
	}, [data]);

	const updateStaff = useCallback(async (id: number | string, input: Partial<Staff>): Promise<Staff> => {
		try {
			const staffId = typeof id === 'string' ? parseInt(id, 10) : id;
			const existing = data.find(item => item.id === staffId);
			if (!existing) {
				throw new Error(`Staff with id ${staffId} not found`);
			}

			const updated = { ...existing, ...input, id: staffId };
			await delay(100); // Simulate API delay
			setData(prev => prev.map(item => item.id === staffId ? updated : item));
			return updated;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
			throw error;
		}
	}, [data]);

	return {
		data,
		loading,
		error,
		reload,
		byId,
		staff: data,
		isLoading: loading,
		load: reload,
		createStaff,
		updateStaff,
	};
}
