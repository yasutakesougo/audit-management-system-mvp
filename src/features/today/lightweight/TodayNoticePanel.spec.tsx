import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodayNoticePanel } from './TodayNoticePanel';

describe('TodayNoticePanel', () => {
  it('折りたたみ既定で件数と先頭通知を表示する', () => {
    render(
      <TodayNoticePanel
        notices={[
          '本日会議あり 15:30〜',
          'Aさん 送迎変更あり',
          '申し送り未確認 2件',
        ]}
      />,
    );

    expect(screen.getByTestId('today-lite-notice-count')).toHaveTextContent('3件');
    expect(screen.getByTestId('today-lite-notice-headline')).toHaveTextContent('本日会議あり 15:30〜');
  });

  it('展開時は最大3件まで表示する', () => {
    render(
      <TodayNoticePanel
        notices={[
          '本日会議あり 15:30〜',
          'Aさん 送迎変更あり',
          '申し送り未確認 2件',
          '4件目（表示しない）',
        ]}
      />,
    );

    const summaryButton = screen.getByRole('button', { name: /注意事項・お知らせ/i });
    fireEvent.click(summaryButton);

    const detailsRegion = screen.getByRole('region');
    expect(within(detailsRegion).getByText('本日会議あり 15:30〜')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('Aさん 送迎変更あり')).toBeInTheDocument();
    expect(within(detailsRegion).getByText('申し送り未確認 2件')).toBeInTheDocument();
    expect(within(detailsRegion).queryByText('4件目（表示しない）')).not.toBeInTheDocument();
  });
});
