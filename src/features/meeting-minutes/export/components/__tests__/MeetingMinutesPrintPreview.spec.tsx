import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MeetingMinutesPrintPreview } from '../MeetingMinutesPrintPreview';
import type { MeetingMinutesExportModel } from '../../exportTypes';

const dummyModel: MeetingMinutesExportModel = {
  title: 'Test Printing Document',
  meetingDate: '2026-04-05',
  category: '朝会',
  attendees: ['Aさん', 'Bさん'],
  sections: [
    {
      kind: 'decision',
      title: '決定事項',
      body: '予算の承認\n時期の繰り上げ',
      emphasis: 'highlight',
      bulletStyle: 'bullet',
    },
    {
      kind: 'action',
      title: 'アクション',
      body: '資料送付',
      emphasis: 'warning',
      bulletStyle: 'check',
    },
  ],
};

describe('MeetingMinutesPrintPreview', () => {
  it('should render meta info correctly', () => {
    render(<MeetingMinutesPrintPreview model={dummyModel} />);
    expect(screen.getByText('Test Printing Document')).toBeInTheDocument();
    expect(screen.getByText(/2026-04-05/)).toBeInTheDocument();
    expect(screen.getByText(/朝会/)).toBeInTheDocument();
    expect(screen.getByText(/Aさん, Bさん/)).toBeInTheDocument();
  });

  it('should render sections sequentially', () => {
    const { container } = render(<MeetingMinutesPrintPreview model={dummyModel} />);
    
    // Check titles
    expect(screen.getByText('決定事項')).toBeInTheDocument();
    expect(screen.getByText('アクション')).toBeInTheDocument();

    // Check bodies
    expect(container).toHaveTextContent('予算の承認');
    expect(container).toHaveTextContent('時期の繰り上げ');
    expect(container).toHaveTextContent('資料送付');
  });

  it('should handle empty sections without crashing', () => {
    render(<MeetingMinutesPrintPreview model={{ ...dummyModel, sections: [] }} />);
    expect(screen.getByText('記録がありません。')).toBeInTheDocument();
  });

  it('should display audience info if provided', () => {
    render(<MeetingMinutesPrintPreview model={dummyModel} audience="field" />);
    expect(screen.getAllByText(/現場向け/).length).toBeGreaterThan(0);
  });
});
