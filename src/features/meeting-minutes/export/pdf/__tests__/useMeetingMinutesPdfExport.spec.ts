import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMeetingMinutesPdfExport } from '../useMeetingMinutesPdfExport';

describe('useMeetingMinutesPdfExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call window.print and temporarily change document.title', () => {
    const originalTitle = 'Audit Management System';
    document.title = originalTitle;

    const printMock = vi.fn(() => {
      // Inside window.print(), the title should be changed to the calculated file name (without .pdf)
      expect(document.title).toBe('2026-04-05_テスト_現場申し送り');
    });
    vi.spyOn(window, 'print').mockImplementation(printMock);

    const { result } = renderHook(() => useMeetingMinutesPdfExport());

    result.current.exportAsPdf({
      model: {
        title: 'テスト',
        meetingDate: '2026-04-05',
        sections: [],
      },
      audience: 'field',
    });

    expect(printMock).toHaveBeenCalledTimes(1);
    // After printing, the title should be restored
    expect(document.title).toBe(originalTitle);
  });
});
