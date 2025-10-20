import type { ComplianceRiskFlag } from '@/domain/compliance/entities';
import {
    getMockStaffComplianceSummaries,
    type StaffComplianceSummary,
} from '@/domain/compliance/staffMock';
import type { Staff } from '@/types';
import { useMemo } from 'react';

const noopAsync = async () => {
	return;
};

export interface StaffWithCompliance extends Staff {
	compliance?: {
		expiringQualifications: StaffComplianceSummary['expiringQualifications'];
		trainingStatus: StaffComplianceSummary['trainingStatus'];
		riskFlags: ComplianceRiskFlag[];
	};
}

const convertToStaff = (summary: StaffComplianceSummary, idIndex: number): StaffWithCompliance => {
	const { profile } = summary;
	const isNightShiftRole = profile.role === '看護師' && profile.employmentType === '兼務';
	const baseShiftStartTime = isNightShiftRole ? '21:00' : '09:30';
	const baseShiftEndTime = isNightShiftRole ? '07:30' : '18:00';

	return {
		id: idIndex,
		staffId: profile.staffId,
		name: profile.name,
		jobTitle: profile.role,
		employmentType: profile.employmentType,
		certifications: profile.qualifications.map((qualification) => qualification.name),
		workDays: ['月', '火', '水', '木', '金'],
		baseShiftStartTime,
		baseShiftEndTime,
		baseWorkingDays: ['月', '火', '水', '木', '金'],
		compliance: {
			expiringQualifications: summary.expiringQualifications,
			trainingStatus: summary.trainingStatus,
			riskFlags: summary.riskFlags,
		},
	};
};

export function useStaff() {
		const complianceSummaries = useMemo(() => {
			const raw = getMockStaffComplianceSummaries();
			return Array.isArray(raw) ? raw : [];
		}, []);

		const staffList = useMemo<StaffWithCompliance[]>(() => {
			if (!Array.isArray(complianceSummaries)) return [];
			return complianceSummaries.map((summary, index) => convertToStaff(summary, index + 1));
		}, [complianceSummaries]);

	const complianceByStaffId = useMemo(() => {
		return new Map(
			complianceSummaries.map((summary, index) => [
				index + 1,
				{
					expiringQualifications: summary.expiringQualifications,
					trainingStatus: summary.trainingStatus,
					riskFlags: summary.riskFlags,
				},
			]),
		);
	}, [complianceSummaries]);

	const aggregatedRiskFlags = useMemo(() => {
		return complianceSummaries.flatMap((summary) => summary.riskFlags);
	}, [complianceSummaries]);

	const createStaff = async (_input: unknown): Promise<StaffWithCompliance> => {
		return {
			id: Date.now(),
			staffId: 'TEMP',
			name: '新規従業者',
			certifications: [],
			workDays: [],
			baseWorkingDays: [],
			compliance: {
				expiringQualifications: [],
				trainingStatus: [],
				riskFlags: [],
			},
		};
	};

	const updateStaff = async (id: number | string, _input: unknown): Promise<StaffWithCompliance> => {
		const numericId = Number(id);
		return (
			staffList.find((staff) => staff.id === numericId) ?? {
				id: numericId,
				staffId: 'UPDATED',
				name: '更新済み従業者',
				certifications: [],
				workDays: [],
				baseWorkingDays: [],
				compliance: {
					expiringQualifications: [],
					trainingStatus: [],
					riskFlags: [],
				},
			}
		);
	};

	const staffMap = useMemo(() => {
		if (!Array.isArray(staffList)) return new Map();
		return new Map<number, StaffWithCompliance>(staffList.map((staff) => [staff.id, staff]));
	}, [staffList]);

	return {
		data: staffList,
		loading: false,
		error: null as Error | null,
		reload: noopAsync,
		byId: staffMap,
		staff: staffList,
		isLoading: false,
		load: noopAsync,
		createStaff,
		updateStaff,
		complianceByStaffId,
		riskFlags: aggregatedRiskFlags,
	};
}
