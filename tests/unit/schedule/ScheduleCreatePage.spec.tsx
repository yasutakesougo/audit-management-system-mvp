import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import type { AutocompleteProps } from '@mui/material/Autocomplete';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

type FromZonedTimeImplementation = (value: Date | string, timeZone: string) => Date;

const fromZonedTimeMock = vi.fn<FromZonedTimeImplementation>();

let actualFromZonedTime: FromZonedTimeImplementation;

vi.mock('@/lib/tz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tz')>('@/lib/tz');
  actualFromZonedTime = actual.fromZonedTime;
  fromZonedTimeMock.mockImplementation((...args) => actual.fromZonedTime(...args));
  return {
    ...actual,
    fromZonedTime: (...args: Parameters<typeof actual.fromZonedTime>) => fromZonedTimeMock(...args),
  };
});

// ---- Mocks ----
const createScheduleMock = vi.fn();
const useSPMock = vi.fn(() => ({}));
vi.mock('@/lib/spClient', () => ({
  createSchedule: (...args: unknown[]) => createScheduleMock(...args),
  useSP: () => useSPMock(),
}));

const showMock = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: (...args: unknown[]) => showMock(...args) }),
}));

const navigateMock = vi.fn();
let locationState: Record<string, unknown> | undefined;
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return Object.assign({}, actual, {
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: locationState }),
  });
});

const useStaffMock = vi.fn();
const useUsersMock = vi.fn();
vi.mock('@/stores/useStaff', () => ({ useStaff: () => useStaffMock() }));
vi.mock('@/stores/useUsers', () => ({ useUsers: () => useUsersMock() }));

const autocompletePropsSpy = vi.fn<(props: AutocompleteProps<unknown, false, false, false>) => void>();

vi.mock('@mui/material/Autocomplete', async () => {
  const actual = await vi.importActual<typeof import('@mui/material/Autocomplete')>('@mui/material/Autocomplete');
  const ActualAutocomplete = actual.default as React.ComponentType<AutocompleteProps<unknown, false, false, false>>;
  const WrappedAutocomplete = React.forwardRef<unknown, AutocompleteProps<unknown, false, false, false>>(
    (props, ref) => {
    autocompletePropsSpy(props);
      return React.createElement(ActualAutocomplete, { ...props, ref });
    },
  );
  WrappedAutocomplete.displayName = 'ScheduleCreatePageTestAutocomplete';
  return {
    __esModule: true,
    ...actual,
    default: WrappedAutocomplete,
  };
});

vi.mock('@/utils/getNow', () => ({
  getNow: () => new Date('2025-05-01T00:00:00.000Z'),
}));

const SUT_PATH = '@/pages/ScheduleCreatePage';
const loadSut = async () => (await import(SUT_PATH)).default;

const staff = [
  { id: 10, name: '常勤 太郎', role: '正社員', certifications: ['普通運転免許'] },
  { id: 11, name: '非常勤 次郎', role: '非常勤', certifications: [] },
];
const users = [
  { id: 20, userId: 'U20', name: '利用者A' },
  { id: 21, userId: 'U21', name: '利用者B' },
];

const setupStores = (
  staffOverrides?: Record<string, unknown>,
  userOverrides?: Record<string, unknown>,
) => {
  useStaffMock.mockReturnValue(
    {
      data: staff,
      loading: false,
      error: null,
      reload: vi.fn(),
      ...staffOverrides,
    } as never,
  );
  useUsersMock.mockReturnValue(
    {
      data: users,
      loading: false,
      error: null,
      reload: vi.fn(),
      ...userOverrides,
    } as never,
  );
};

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
};

const submitForm = () => {
  const submitButton = screen.getByRole('button', { name: '保存' });
  const form = submitButton.closest('form');
  if (!form) {
    throw new Error('Schedule form element was not found');
  }
  fireEvent.submit(form);
};

const selectOption = async (fieldLabel: string, optionText: string) => {
  const trigger = screen.getByRole('combobox', { name: new RegExp(fieldLabel) });
  fireEvent.mouseDown(trigger);
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByRole('option', { name: optionText });
  fireEvent.click(option);
};

const openAutocompleteList = async (fieldLabel: string) => {
  const input = screen.getByRole('combobox', { name: new RegExp(fieldLabel) });
  fireEvent.mouseDown(input);
  try {
    return await screen.findByRole('listbox');
  } catch {
    const parent = input.parentElement;
    if (parent) {
      fireEvent.mouseDown(parent);
      try {
        return await screen.findByRole('listbox');
      } catch {
        const grandParent = parent.parentElement;
        if (grandParent) {
          fireEvent.mouseDown(grandParent);
          try {
            return await screen.findByRole('listbox');
          } catch {
            fireEvent.click(grandParent);
            try {
              return await screen.findByRole('listbox');
            } catch {
              // fall through to other strategies
            }
          }
        }
      }
    }
    const opener = input.parentElement?.querySelector('button[aria-label="Open"]');
    if (opener) {
      fireEvent.mouseDown(opener);
    } else {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    }
  }
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'a' } });
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  return screen.findByRole('listbox');
};

const selectAutocompleteOption = async (fieldLabel: string, optionText: string) => {
  const listbox = await openAutocompleteList(fieldLabel);
  const option = within(listbox).getByRole('option', { name: optionText });
  fireEvent.click(option);
};

beforeEach(async () => {
  vi.clearAllMocks();
  if (!actualFromZonedTime) {
    const actual = await vi.importActual<typeof import('@/lib/tz')>('@/lib/tz');
    actualFromZonedTime = actual.fromZonedTime;
  }
  fromZonedTimeMock.mockImplementation((value, tz) => actualFromZonedTime(value, tz));
  setupStores();
  locationState = undefined;
  process.env.VITE_SCHEDULES_TZ = process.env.VITE_SCHEDULES_TZ || 'Asia/Tokyo';
});

afterEach(() => {
  cleanup();
});

describe('ScheduleCreatePage', () => {
  it('初期表示（新規作成）でプレビュー案内を表示し、必須未入力でバリデーションが出る', async () => {
    const Page = await loadSut();
    render(<Page />);

    expect(screen.getByText(/新しい予定を一から登録/)).toBeInTheDocument();
    expect(screen.getByTestId('schedule-preview').textContent).toMatch(/プレビュー:/);

    submitForm();

    const titleInput = screen.getByLabelText('タイトル', { exact: false, selector: 'input' });
    const helperId = titleInput.getAttribute('aria-describedby');
    expect(helperId).toBeTruthy();
    await waitFor(() => {
      const helper = helperId ? document.getElementById(helperId) : null;
      expect(helper?.textContent?.trim()).toBe('タイトルを入力してください');
    });
    expect(createScheduleMock).not.toHaveBeenCalled();
  });

  it('allDay ONで 00:00 固定/翌日補正、OFFで直前の時刻に戻る', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('開始時刻', '09:10');
    fill('終了時刻', '09:40');

    fireEvent.click(screen.getByLabelText('終日イベント', { exact: false }));
    expect(screen.getByLabelText('開始時刻', { exact: false })).toHaveValue('00:00');
    expect(screen.getByLabelText('終了時刻', { exact: false })).toHaveValue('00:00');

    fireEvent.click(screen.getByLabelText('終日イベント', { exact: false }));
    expect(screen.getByLabelText('開始時刻', { exact: false })).toHaveValue('09:10');
    expect(screen.getByLabelText('終了時刻', { exact: false })).toHaveValue('09:40');
  });

  it('終了≦開始、または最短未満(15分)を弾く', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', 'テスト');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '10:00');
    fill('終了時刻', '09:59');

    submitForm();
    expect(await screen.findByText(/終了は開始より後/)).toBeInTheDocument();

    fill('終了時刻', '10:14');
    submitForm();
    expect(await screen.findByText(/15分以上/)).toBeInTheDocument();
  });

  it('送迎/車両使用時は担当者必須で、免許未登録職員には警告を出す', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '送迎案件');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');

    fireEvent.click(screen.getByLabelText('使用車両が必要', { exact: false }));
    submitForm();
    expect(await screen.findByText('車両利用時は担当職員を選択してください')).toBeInTheDocument();

    await selectOption('担当職員', '非常勤 次郎');
    expect(await screen.findByText(/普通運転免許が未登録です/)).toBeInTheDocument();

    await selectOption('担当職員', '常勤 太郎（普通運転免許）');
    await waitFor(() => {
      expect(screen.queryByText(/普通運転免許が未登録です/)).toBeNull();
    });
  });

  it('日時が壊れている場合は general 警告を出して保存しない', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '壊れた時間');
    fill('開始日', '2025-05-01');

    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');

    const originalImpl = fromZonedTimeMock.getMockImplementation();
    fromZonedTimeMock.mockImplementation(() => {
      throw new Error('broken range');
    });

  submitForm();
  const alerts = await screen.findAllByRole('alert');
  expect(alerts.some((alert) => within(alert).queryByText('日時の指定が正しくありません。'))).toBe(true);
  fromZonedTimeMock.mockImplementation(originalImpl ?? ((value, tz) => actualFromZonedTime(value, tz)));
    expect(createScheduleMock).not.toHaveBeenCalled();
  });

  it('Submit 成功: payload/トースト/ナビゲーションを確認', async () => {
    createScheduleMock.mockResolvedValueOnce({});
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '正常作成');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');
    await selectOption('担当職員', '常勤 太郎（普通運転免許）');
    await selectAutocompleteOption('利用者', '利用者A（U20）');
    await waitFor(() => {
      expect(screen.getByText('対象の利用者を選択しました')).toBeInTheDocument();
    });

    submitForm();

    await waitFor(() => {
      expect(createScheduleMock).toHaveBeenCalledTimes(1);
      const payload = createScheduleMock.mock.calls[0][1];
      expect(payload).toMatchObject({
        Title: '正常作成',
        AllDay: false,
        StaffIdId: 10,
        UserIdId: 20,
      });
    });

    expect(showMock).toHaveBeenCalledWith('success', '予定を作成しました');
    expect(navigateMock).toHaveBeenCalledWith('/schedule', { replace: true });
  });

  it('Submit 失敗: エラー表示とトースト', async () => {
    createScheduleMock.mockRejectedValueOnce(new Error('Internal Boom'));
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '失敗ケース');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '09:30');

    submitForm();
    const errorAlert = await screen.findByText('Internal Boom');
    expect(errorAlert).toBeInTheDocument();
    expect(showMock).toHaveBeenCalledWith('error', 'Internal Boom');
  });

  it('Submit 失敗: 非Errorでも汎用メッセージを表示する', async () => {
    createScheduleMock.mockRejectedValueOnce('fatal');
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '非Error失敗');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');

    submitForm();
    const fallback = await screen.findByText('保存に失敗しました。時間をおいて再実行してください。');
    expect(fallback).toBeInTheDocument();
    expect(showMock).toHaveBeenCalledWith('error', '保存に失敗しました。時間をおいて再実行してください。');
  });

  it('複製ドラフトがある場合、プレフィル通知を表示', async () => {
    locationState = {
      sourceId: 123,
      strategy: 'today',
      draft: {
        title: '元予定',
        _initial: {
          startLocalISO: '2025-05-01T09:00:00+09:00',
          endLocalISO: '2025-05-01T10:00:00+09:00',
          allDay: false,
          preview: '5/1 09:00–10:00',
        },
      },
    };
    const Page = await loadSut();
    render(<Page />);

    const notice = await screen.findByTestId('schedule-prefill-notice');
    expect(notice.textContent).toMatch(/#123 の予定を複製しています/);
    expect(notice.textContent).toMatch(/今日の時間割に合わせて複製しました/);
  });

  it('複製ドラフト（終日）の場合は00:00固定と戦略説明を表示する', async () => {
    locationState = {
      draft: {
        _initial: {
          startLocalISO: '2025-05-02T00:00:00+09:00',
          endLocalISO: '2025-05-02T00:00:00+09:00',
          allDay: true,
          preview: '5/2 終日',
        },
      },
      strategy: 'nextWeekday',
    };

    const Page = await loadSut();
    render(<Page />);

  const startTime = screen.getByLabelText('開始時刻', { selector: 'input' }) as HTMLInputElement;
  const endTime = screen.getByLabelText('終了時刻', { selector: 'input' }) as HTMLInputElement;
    expect(startTime.value).toBe('00:00');
    expect(endTime.value).toBe('00:00');

  const titleInput = screen.getByRole('textbox', { name: 'タイトル' }) as HTMLInputElement;
    expect(titleInput.value).toBe('');

    const notice = await screen.findByTestId('schedule-prefill-notice');
    expect(notice.textContent).toMatch(/複製元 の予定を複製しています/);
    expect(notice.textContent).toMatch(/次の平日に合わせて複製しました。/);
  });

  it('職員取得エラー時は選択肢が無効になりエラーメッセージを表示する', async () => {
    setupStores({ data: [], error: new Error('staff load failed'), loading: false });
    const Page = await loadSut();
    render(<Page />);

    const staffSelect = screen.getByRole('combobox', { name: '担当職員' });
    expect(staffSelect).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/職員情報の取得に失敗しました/)).toHaveTextContent('staff load failed');
  });

  it('利用者取得エラー時はヘルパーテキストに失敗内容を表示する', async () => {
    setupStores(undefined, { data: [], error: new Error('users failed'), loading: false });
    const Page = await loadSut();
    render(<Page />);

    expect(screen.getByText(/利用者リストの取得に失敗しました/)).toHaveTextContent('users failed');
  });

  it('サービス種別で送迎を選ぶだけでも担当者必須のバリデーションが発火する', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '送迎案件（サービス種別）');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');
    await selectOption('サービス種別', '送迎');

    submitForm();
    expect(await screen.findByText('車両利用時は担当職員を選択してください')).toBeInTheDocument();
  });

  it('終日切替時に終了日を補正し欠損時は既定時刻に戻す', async () => {
    const Page = await loadSut();
    render(<Page />);

    const allDaySwitch = screen.getByLabelText('終日イベント', { exact: false });
    const startDate = screen.getByLabelText('開始日', { selector: 'input' }) as HTMLInputElement;
    const endDate = screen.getByLabelText('終了日', { selector: 'input' }) as HTMLInputElement;
    const startTime = screen.getByLabelText('開始時刻', { selector: 'input' }) as HTMLInputElement;
    const endTime = screen.getByLabelText('終了時刻', { selector: 'input' }) as HTMLInputElement;

    fireEvent.change(startTime, { target: { value: '' } });
    fireEvent.change(endTime, { target: { value: '' } });
    fireEvent.click(allDaySwitch);
    expect(startTime.value).toBe('00:00');
    expect(endTime.value).toBe('00:00');

    fireEvent.click(allDaySwitch);
    expect(startTime.value).toBe('09:00');
    expect(endTime.value).toBe('10:00');

    fireEvent.change(startDate, { target: { value: '2025-05-10' } });
    fireEvent.change(endDate, { target: { value: '' } });
    fireEvent.click(allDaySwitch);
    expect(endDate.value).toBe('2025-05-10');

    fireEvent.click(allDaySwitch);
    fireEvent.change(endDate, { target: { value: '2025-05-09' } });
    fireEvent.click(allDaySwitch);
    expect(endDate.value).toBe('2025-05-10');

    fireEvent.click(allDaySwitch);
    fireEvent.change(startDate, { target: { value: '' } });
    fireEvent.change(endDate, { target: { value: '2025-05-12' } });
    fireEvent.click(allDaySwitch);
    expect(endDate.value).toBe('2025-05-12');
  });

  it('開始日時が欠けているとプレビュー案内を出す', async () => {
    const Page = await loadSut();
    render(<Page />);

    const previewText = () => screen.getByTestId('schedule-preview').textContent ?? '';
    const startDate = screen.getByLabelText('開始日', { selector: 'input' });
    const startTime = screen.getByLabelText('開始時刻', { selector: 'input' });
    const endDate = screen.getByLabelText('終了日', { selector: 'input' });
    const endTime = screen.getByLabelText('終了時刻', { selector: 'input' });

    fireEvent.change(startDate, { target: { value: '' } });
    await waitFor(() => {
      expect(previewText()).toContain('日時を入力するとプレビューが表示されます');
    });

    fireEvent.change(startDate, { target: { value: '2025-06-01' } });
    fireEvent.change(startTime, { target: { value: '' } });
    await waitFor(() => {
      expect(previewText()).toContain('日時を入力するとプレビューが表示されます');
    });

    fireEvent.change(startTime, { target: { value: '09:00' } });
    fireEvent.change(endDate, { target: { value: '' } });
    fireEvent.change(endTime, { target: { value: '' } });
    await waitFor(() => {
      expect(previewText()).toContain('日時を入力するとプレビューが表示されます');
    });
  });

  it('開始・終了日時を空にすると個別必須エラーを表示する', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '必須チェック');
    fireEvent.change(screen.getByLabelText('開始日', { exact: false }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('終了日', { exact: false }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('開始時刻', { exact: false }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('終了時刻', { exact: false }), { target: { value: '' } });

    submitForm();

    expect(await screen.findByText('開始日を入力してください')).toBeInTheDocument();
    expect(await screen.findByText('開始時刻を入力してください')).toBeInTheDocument();
    expect(await screen.findByText('終了日を入力してください')).toBeInTheDocument();
    expect(await screen.findByText('終了時刻を入力してください')).toBeInTheDocument();
  });

  it('利用者オートコンプリートが読み込み中の場合はメッセージを表示する', async () => {
    setupStores(undefined, { data: [], loading: true, error: null });
    const Page = await loadSut();
    render(<Page />);

    const hasLoadingMessage = autocompletePropsSpy.mock.calls.some(([props]) => props?.noOptionsText === '読み込み中…');
    expect(hasLoadingMessage).toBe(true);
  });

  it('利用者オートコンプリートはフォールバックラベルを整形する', async () => {
    setupStores(undefined, {
      data: [{ id: 30, userId: '', name: '', nameKana: '', furigana: '' }],
      loading: false,
      error: null,
    });
    const Page = await loadSut();
    render(<Page />);

    await selectAutocompleteOption('利用者', '氏名未登録（ID:30）');
    await waitFor(() => {
      expect(screen.getByText('対象の利用者を選択しました')).toBeInTheDocument();
    });
  });

  it('担当職員を未選択に戻すとバリデーションが再発火する', async () => {
    const Page = await loadSut();
    render(<Page />);

    fill('タイトル', '担当職員解除');
    fill('開始日', '2025-05-01');
    fill('終了日', '2025-05-01');
    fill('開始時刻', '09:00');
    fill('終了時刻', '10:00');
    await selectOption('サービス種別', '送迎');
    await selectOption('担当職員', '常勤 太郎（普通運転免許）');
    await selectOption('担当職員', '未選択');

    submitForm();
    expect(await screen.findByText('車両利用時は担当職員を選択してください')).toBeInTheDocument();
  });

  it('ストアデータが配列でなくても空配列として扱う', async () => {
    setupStores({ data: null }, { data: null });
    const Page = await loadSut();
    render(<Page />);

    await selectOption('担当職員', '未選択');
    const input = screen.getByRole('combobox', { name: /利用者/ });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'a' } });
    expect(await screen.findByText('該当する利用者が見つかりません')).toBeInTheDocument();
  });
});
