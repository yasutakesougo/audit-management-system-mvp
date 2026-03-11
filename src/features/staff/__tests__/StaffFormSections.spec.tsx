/**
 * StaffForm section components — light render (smoke) tests
 *
 * Strategy:
 * - render() from @testing-library/react with minimal prop fixtures.
 * - No interactions; just assert the key DOM text and structure is present.
 * - No mocks needed: these are pure presentational components.
 */
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { StaffFormBasicInfoSection } from '../components/StaffFormBasicInfoSection';
import { StaffFormCertSection } from '../components/StaffFormCertSection';
import { StaffFormContactSection } from '../components/StaffFormContactSection';
import { StaffFormHeader } from '../components/StaffFormHeader';
import { StaffFormShiftSection } from '../components/StaffFormShiftSection';
import { StaffFormWorkDaysSection } from '../components/StaffFormWorkDaysSection';
import type { Errors, FormValues } from '../domain/staffFormDomain';
import { BASE_WEEKDAY_DEFAULTS, CERTIFICATION_OPTIONS, DAYS } from '../domain/staffFormDomain';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const makeValues = (overrides: Partial<FormValues> = {}): FormValues => ({
  StaffID: '',
  FullName: '',
  Email: '',
  Phone: '',
  Role: '',
  WorkDays: [],
  Certifications: [],
  IsActive: true,
  BaseShiftStartTime: '08:30',
  BaseShiftEndTime: '17:30',
  BaseWorkingDays: [...BASE_WEEKDAY_DEFAULTS],
  ...overrides,
});

const noopSetField = () => {};
const noopToggle = () => {};

// ── StaffFormHeader ──────────────────────────────────────────────────────────

describe('StaffFormHeader', () => {
  it('renders "新規職員登録" in create mode', () => {
    render(
      <StaffFormHeader mode="create" handleClose={noopToggle} />
    );
    expect(screen.getByText('新規職員登録')).toBeDefined();
  });

  it('renders "職員情報編集" in update mode', () => {
    render(
      <StaffFormHeader mode="update" handleClose={noopToggle} />
    );
    expect(screen.getByText('職員情報編集')).toBeDefined();
  });

  it('renders close button when onClose is provided', () => {
    render(
      <StaffFormHeader mode="create" onClose={noopToggle} handleClose={noopToggle} />
    );
    // MUI IconButton renders a <button>; CloseIcon renders inside it
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render close button when onClose is omitted', () => {
    render(
      <StaffFormHeader mode="create" handleClose={noopToggle} />
    );
    // No onClose → no IconButton in the DOM
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});

// ── StaffFormBasicInfoSection ────────────────────────────────────────────────

describe('StaffFormBasicInfoSection', () => {
  const errRefs = { fullName: createRef<HTMLInputElement>() };

  it('renders the スタッフID label', () => {
    render(
      <StaffFormBasicInfoSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByLabelText(/スタッフID/i)).toBeDefined();
  });

  it('renders the 氏名 label', () => {
    render(
      <StaffFormBasicInfoSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByLabelText(/氏名/i)).toBeDefined();
  });

  it('displays provided FullName value in the input', () => {
    render(
      <StaffFormBasicInfoSection
        values={makeValues({ FullName: '山田 太郎' })}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    const input = screen.getByDisplayValue('山田 太郎');
    expect(input).toBeDefined();
  });

  it('shows fullName error helper text when error is set', () => {
    const errors: Errors = { fullName: '氏名は必須です' };
    render(
      <StaffFormBasicInfoSection
        values={makeValues()}
        errors={errors}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByText('氏名は必須です')).toBeDefined();
  });

  it('renders 基本情報 section heading', () => {
    render(
      <StaffFormBasicInfoSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByText('基本情報')).toBeDefined();
  });
});

// ── StaffFormContactSection ──────────────────────────────────────────────────

describe('StaffFormContactSection', () => {
  const errRefs = {
    email: createRef<HTMLInputElement>(),
    phone: createRef<HTMLInputElement>(),
  };

  it('renders 連絡先情報 heading', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByText('連絡先情報')).toBeDefined();
  });

  it('renders the メール input', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByLabelText(/メール/i)).toBeDefined();
  });

  it('renders the 電話番号 input', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByLabelText(/電話番号/i)).toBeDefined();
  });

  it('renders the 役職 input', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByLabelText(/役職/i)).toBeDefined();
  });

  it('displays email error helper text', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{ email: 'メール形式が不正です' }}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByText('メール形式が不正です')).toBeDefined();
  });

  it('displays phone error helper text', () => {
    render(
      <StaffFormContactSection
        values={makeValues()}
        errors={{ phone: '電話番号を正しく入力してください' }}
        errRefs={errRefs}
        setField={noopSetField}
      />
    );
    expect(screen.getByText('電話番号を正しく入力してください')).toBeDefined();
  });
});

// ── StaffFormShiftSection ────────────────────────────────────────────────────

describe('StaffFormShiftSection', () => {
  const errRefs = { baseShift: createRef<HTMLInputElement>() };

  it('renders 基本勤務パターン heading', () => {
    render(
      <StaffFormShiftSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    expect(screen.getByText('基本勤務パターン')).toBeDefined();
  });

  it('renders 基本勤務曜日 sub-label', () => {
    render(
      <StaffFormShiftSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    expect(screen.getByText('基本勤務曜日')).toBeDefined();
  });

  it('renders all 5 weekday labels (月火水木金)', () => {
    render(
      <StaffFormShiftSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    for (const label of ['月', '火', '水', '木', '金']) {
      // Multiple '月' etc. may appear (WorkDays section is separate); use getAllByText
      const els = screen.getAllByText(label);
      expect(els.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders base shift times as input values', () => {
    render(
      <StaffFormShiftSection
        values={makeValues({ BaseShiftStartTime: '09:00', BaseShiftEndTime: '18:00' })}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    expect(screen.getByDisplayValue('09:00')).toBeDefined();
    expect(screen.getByDisplayValue('18:00')).toBeDefined();
  });

  it('shows baseShift error helper text', () => {
    render(
      <StaffFormShiftSection
        values={makeValues()}
        errors={{ baseShift: '時刻はHH:MM形式で入力してください' }}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    expect(screen.getByText('時刻はHH:MM形式で入力してください')).toBeDefined();
  });

  it('renders caption text about overallocation detection', () => {
    render(
      <StaffFormShiftSection
        values={makeValues()}
        errors={{}}
        errRefs={errRefs}
        setField={noopSetField}
        toggleBaseWorkingDay={noopToggle}
      />
    );
    expect(
      screen.getByText(/標準勤務時間を設定すると/)
    ).toBeDefined();
  });
});

// ── StaffFormWorkDaysSection ─────────────────────────────────────────────────

describe('StaffFormWorkDaysSection', () => {
  it('renders 出勤曜日 heading', () => {
    render(
      <StaffFormWorkDaysSection values={makeValues()} toggleWorkDay={noopToggle} />
    );
    expect(screen.getByText('出勤曜日')).toBeDefined();
  });

  it('renders all 7 day checkboxes', () => {
    render(
      <StaffFormWorkDaysSection values={makeValues()} toggleWorkDay={noopToggle} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // 7 checkboxes — one per day (Mon-Sun)
    expect(checkboxes).toHaveLength(DAYS.length);
  });

  it('checks the checkbox for days in WorkDays', () => {
    render(
      <StaffFormWorkDaysSection
        values={makeValues({ WorkDays: ['Mon', 'Wed'] })}
        toggleWorkDay={noopToggle}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Mon is index 0, Wed is index 2 in DAYS
    const monIdx = DAYS.findIndex((d) => d.value === 'Mon');
    const wedIdx = DAYS.findIndex((d) => d.value === 'Wed');
    expect((checkboxes[monIdx] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[wedIdx] as HTMLInputElement).checked).toBe(true);
  });

  it('leaves unchecked checkboxes for days NOT in WorkDays', () => {
    render(
      <StaffFormWorkDaysSection values={makeValues({ WorkDays: [] })} toggleWorkDay={noopToggle} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(false);
    });
  });
});

// ── StaffFormCertSection ──────────────────────────────────────────────────────

describe('StaffFormCertSection', () => {
  it('renders 資格 heading', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    expect(screen.getByText('資格')).toBeDefined();
  });

  it('renders all CERTIFICATION_OPTIONS as chips', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    for (const opt of CERTIFICATION_OPTIONS) {
      expect(screen.getByText(opt.label)).toBeDefined();
    }
  });

  it('renders the カスタム資格を追加 input', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    expect(screen.getByLabelText(/カスタム資格を追加/i)).toBeDefined();
  });

  it('renders the 追加 button', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    expect(screen.getByRole('button', { name: '追加' })).toBeDefined();
  });

  it('does NOT render 選択された資格 section when Certifications is empty', () => {
    render(
      <StaffFormCertSection
        values={makeValues({ Certifications: [] })}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    expect(screen.queryByText('選択された資格:')).toBeNull();
  });

  it('renders 選択された資格 section when Certifications is non-empty', () => {
    render(
      <StaffFormCertSection
        values={makeValues({ Certifications: ['看護師', '保育士'] })}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    expect(screen.getByText('選択された資格:')).toBeDefined();
    expect(screen.getAllByText('看護師').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('保育士').length).toBeGreaterThanOrEqual(1);
  });

  it('the 追加 button is disabled when customCertification is empty', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification=""
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    const addBtn = screen.getByRole('button', { name: '追加' }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('the 追加 button is enabled when customCertification has a value', () => {
    render(
      <StaffFormCertSection
        values={makeValues()}
        customCertification="新しい資格"
        setCustomCertification={() => {}}
        toggleCertification={noopToggle}
        removeCertification={noopToggle}
        handleAddCustomCertification={noopToggle}
      />
    );
    const addBtn = screen.getByRole('button', { name: '追加' }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(false);
  });
});
