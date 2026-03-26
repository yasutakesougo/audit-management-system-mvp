import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ServiceStructure } from '../domain/serviceStructure.types';
import { TodayServiceStructureCard } from './TodayServiceStructureCard';

// ── Test Helpers ──

const fullStructure: ServiceStructure = {
  dayCare: {
    firstWorkroomStaff: ['山田', '佐藤'],
    secondWorkroomStaff: ['鈴木'],
    outdoorActivityStaff: ['田中'],
    japaneseRoomStaff: ['村上'],
    playroomStaff: ['中村'],
  },
  lifeSupport: {
    shortStayCount: 1,
    temporaryCareCount: 2,
    intakeDeskStaff: ['佐藤'],
    supportStaff: ['高橋', '伊藤'],
    coordinatorStaff: ['田中'],
    notes: ['送迎時間確認あり'],
  },
  decisionSupport: {
    directorPresent: true,
    serviceManagerPresent: true,
    nursePresent: true,
    directorNames: ['山田'],
    serviceManagerNames: ['佐藤'],
    nurseNames: ['鈴木'],
  },
  operationalSupport: {
    accountantPresent: true,
    accountantNames: ['高橋'],
    mealStaff: ['渡辺', '小林'],
    transportStaff: ['加藤', '吉田'],
    volunteerStaff: ['山口'],
    visitorNames: ['外部監査員・佐藤'],
  },
};

const emptyLifeSupport: ServiceStructure = {
  ...fullStructure,
  lifeSupport: {
    shortStayCount: 0,
    temporaryCareCount: 0,
    intakeDeskStaff: [],
    supportStaff: [],
    coordinatorStaff: [],
    notes: [],
  },
};

const emptyDayCare: ServiceStructure = {
  ...fullStructure,
  dayCare: {
    firstWorkroomStaff: [],
    secondWorkroomStaff: [],
    outdoorActivityStaff: [],
    japaneseRoomStaff: [],
    playroomStaff: [],
  },
};

const partialPresence: ServiceStructure = {
  ...fullStructure,
  decisionSupport: {
    directorPresent: true,
    serviceManagerPresent: false,
    nursePresent: true,
    directorNames: ['山田'],
    serviceManagerNames: [],
    nurseNames: ['鈴木'],
  },
};

const emptyOperationalSupport: ServiceStructure = {
  ...fullStructure,
  operationalSupport: {
    accountantPresent: false,
    accountantNames: [],
    mealStaff: [],
    transportStaff: [],
    volunteerStaff: [],
    visitorNames: [],
  },
};

// ── Tests ──

describe('TodayServiceStructureCard — 生活介護', () => {
  it('生活介護の配置・役割が表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    const section = within(screen.getByTestId('section-daycare'));
    expect(section.getByText('第一作業室')).toBeInTheDocument();
    expect(section.getByText('山田、佐藤')).toBeInTheDocument();
    expect(section.getByText('第二作業室')).toBeInTheDocument();
    expect(section.getByText('鈴木')).toBeInTheDocument();
    expect(section.getByText('和室')).toBeInTheDocument();
    expect(section.getByText('村上')).toBeInTheDocument();
    expect(section.getByText('プレイルーム')).toBeInTheDocument();
    expect(section.getByText('中村')).toBeInTheDocument();
  });

  it('職員未割当でも5項目がデフォルト表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={emptyDayCare} />);

    const section = within(screen.getByTestId('section-daycare'));
    expect(section.getByText('第一作業室')).toBeInTheDocument();
    expect(section.getByText('第二作業室')).toBeInTheDocument();
    expect(section.getByText('外活動')).toBeInTheDocument();
    expect(section.getByText('和室')).toBeInTheDocument();
    expect(section.getByText('プレイルーム')).toBeInTheDocument();
    expect(section.getAllByText('未割当')).toHaveLength(5);
  });
});

describe('TodayServiceStructureCard — 生活支援', () => {
  it('受け入れ件数・窓口・対応職員が表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    expect(screen.getByTestId('section-life-support')).toBeInTheDocument();
    expect(screen.getByText('SS 1件')).toBeInTheDocument();
    expect(screen.getByText('一時 2件')).toBeInTheDocument();
    expect(screen.getByText('窓口')).toBeInTheDocument();
    expect(screen.getByText('高橋、伊藤')).toBeInTheDocument();
  });

  it('注意事項が表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    expect(screen.getByText(/送迎時間確認あり/)).toBeInTheDocument();
  });

  it('件数が0のとき空状態メッセージが表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={emptyLifeSupport} />);

    expect(screen.getByTestId('empty-life-support')).toBeInTheDocument();
    expect(screen.getByText('受け入れ予定なし')).toBeInTheDocument();
  });
});

describe('TodayServiceStructureCard — 判断窓口', () => {
  it('所長・サビ管・ナース在席が表示される（管理者・専門職のみ）', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    const section = within(screen.getByTestId('section-decision-support'));
    expect(section.getByText('所長')).toBeInTheDocument();
    expect(section.getByText('サビ管')).toBeInTheDocument();
    expect(section.getByText('ナース')).toBeInTheDocument();
    // 3 roles, all present
    const chips = section.getAllByText('在席');
    expect(chips.length).toBe(3);
  });

  it('一部不在でも表示が壊れない', () => {
    render(<TodayServiceStructureCard serviceStructure={partialPresence} />);

    const section = within(screen.getByTestId('section-decision-support'));
    expect(section.getByText('所長')).toBeInTheDocument();
    expect(section.getByText('サビ管')).toBeInTheDocument();
    // serviceManager is absent
    expect(section.getByText('不在')).toBeInTheDocument();
    // director and nurse are present
    const presentChips = section.getAllByText('在席');
    expect(presentChips.length).toBe(2);
  });
});

describe('TodayServiceStructureCard — 運営サポート', () => {
  it('会計・給食・送迎が表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    const section = within(screen.getByTestId('section-operational-support'));
    expect(section.getByText('会計')).toBeInTheDocument();
    expect(section.getByText('給食')).toBeInTheDocument();
    expect(section.getByText('渡辺、小林')).toBeInTheDocument();
    expect(section.getByText('送迎')).toBeInTheDocument();
    expect(section.getByText('加藤、吉田')).toBeInTheDocument();
  });

  it('会計の在席チップが表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    const section = within(screen.getByTestId('section-operational-support'));
    expect(section.getByText('在席')).toBeInTheDocument();
    expect(section.getByText('高橋')).toBeInTheDocument();
  });

  it('日中ボランティア・日中来客が表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    const section = within(screen.getByTestId('section-operational-support'));
    expect(section.getByText('日中ボランティア')).toBeInTheDocument();
    expect(section.getByText('山口')).toBeInTheDocument();
    expect(section.getByText('日中来客')).toBeInTheDocument();
    expect(section.getByText('外部監査員・佐藤')).toBeInTheDocument();
  });

  it('会計・給食・日中ボランティア・日中来客が空でもデフォルト表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={emptyOperationalSupport} />);

    const section = within(screen.getByTestId('section-operational-support'));
    expect(section.getByText('会計')).toBeInTheDocument();
    expect(section.getByText('不在')).toBeInTheDocument();
    expect(section.getByText('給食')).toBeInTheDocument();
    expect(section.getByText('日中ボランティア')).toBeInTheDocument();
    expect(section.getByText('日中来客')).toBeInTheDocument();
    expect(section.getAllByText('未割当')).toHaveLength(3);
  });
});

describe('TodayServiceStructureCard — 全体', () => {
  it('data-testid が設定されている', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    expect(screen.getByTestId('today-service-structure-card')).toBeInTheDocument();
  });

  it('4セクションヘッダーが表示される', () => {
    render(<TodayServiceStructureCard serviceStructure={fullStructure} />);

    expect(screen.getByText(/生活介護/)).toBeInTheDocument();
    expect(screen.getByText(/生活支援/)).toBeInTheDocument();
    expect(screen.getByText(/判断窓口/)).toBeInTheDocument();
    expect(screen.getByText(/運営サポート/)).toBeInTheDocument();
  });
});
