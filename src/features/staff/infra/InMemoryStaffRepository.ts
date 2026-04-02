import type { Staff } from '@/types';
import type { StaffRepository, StaffRepositoryListParams } from '../domain/StaffRepository';

export class InMemoryStaffRepository implements StaffRepository {
  private data: Staff[];

  constructor(initialData: Staff[] = []) {
    this.data = [...initialData];
  }

  public async getAll(_params?: StaffRepositoryListParams): Promise<Staff[]> {
    return [...this.data];
  }

  public async getById(id: number | string): Promise<Staff | null> {
    const numericId = Number(id);
    return this.data.find(s => s.id === numericId) || null;
  }

  public async create(payload: Partial<Staff>): Promise<Staff> {
    const newId = Math.max(0, ...this.data.map(s => s.id)) + 1;
    const now = new Date().toISOString();
    const newStaff: Staff = {
      id: newId,
      staffId: payload.staffId || `STF${String(newId).padStart(3, '0')}`,
      name: payload.name || `職員 ${newId}`,
      certifications: payload.certifications || [],
      workDays: payload.workDays || [],
      baseWorkingDays: payload.baseWorkingDays || [],
      modified: now,
      created: now,
      ...payload,
    } as Staff;
    this.data.push(newStaff);
    return newStaff;
  }

  public async update(id: number | string, payload: Partial<Staff>): Promise<Staff> {
    const numericId = Number(id);
    const index = this.data.findIndex(s => s.id === numericId);
    if (index === -1) throw new Error('Staff not found');

    const updated: Staff = {
      ...this.data[index],
      ...payload,
      id: numericId,
      modified: new Date().toISOString(),
    } as Staff;

    this.data[index] = updated;
    return updated;
  }

  public async remove(id: number | string): Promise<void> {
    const numericId = Number(id);
    this.data = this.data.filter(s => s.id !== numericId);
  }
}

const now = new Date().toISOString();
const makeStaff = (id: number, overrides: Partial<Staff>): Staff => ({
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
  certifications: ['社会福祉士', '精神保健福祉士'],
  workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  baseShiftStartTime: '09:00',
  baseShiftEndTime: '17:00',
  baseWorkingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  modified: now,
  created: now,
  ...overrides,
});

export const demoStaffData: Staff[] = [
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

export const inMemoryStaffRepository = new InMemoryStaffRepository(demoStaffData);
