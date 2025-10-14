import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '@/lib/env';

vi.mock('@/lib/env', () => ({
  getAppConfig: vi.fn(),
}));

const RealDateTimeFormat = Intl.DateTimeFormat;

const makeConfig = (overrides: Partial<AppConfig>): AppConfig => ({
  VITE_SP_RESOURCE: '',
  VITE_SP_SITE_RELATIVE: '',
  VITE_SP_RETRY_MAX: '4',
  VITE_SP_RETRY_BASE_MS: '400',
  VITE_SP_RETRY_MAX_DELAY_MS: '5000',
  VITE_MSAL_CLIENT_ID: '',
  VITE_MSAL_TENANT_ID: '',
  VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  VITE_AUDIT_DEBUG: '',
  VITE_AUDIT_BATCH_SIZE: '',
  VITE_AUDIT_RETRY_MAX: '',
  VITE_AUDIT_RETRY_BASE: '',
  schedulesCacheTtlSec: 60,
  graphRetryMax: 2,
  graphRetryBaseMs: 300,
  graphRetryCapMs: 2000,
  schedulesTz: '',
  schedulesWeekStart: 1,
  isDev: false,
  ...overrides,
});

const mockDateTimeFormat = (
  opts: {
    intlTz?: string;
    invalidZones?: string[];
  } = {}
) => {
  const invalid = new Set(opts.invalidZones ?? []);
  const intlZone = opts.intlTz ?? 'America/New_York';

  return vi
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation(((locale?: string | string[], options?: Intl.DateTimeFormatOptions) => {
      const tz = options?.timeZone;
      if (tz && invalid.has(tz)) {
        throw new RangeError('Invalid time zone');
      }
      if (!options || !options.timeZone) {
        return {
          format: vi.fn(),
          formatToParts: vi.fn(),
          resolvedOptions: () => ({ timeZone: intlZone }),
        } as unknown as Intl.DateTimeFormat;
      }
  return new RealDateTimeFormat(locale as Intl.LocalesArgument, options);
    }) as typeof Intl.DateTimeFormat);
};

const { getAppConfig } = await import('@/lib/env');
const scheduleLib = await import('@/utils/scheduleTz');
const mockedGetAppConfig = vi.mocked(getAppConfig);

afterEach(() => {
  vi.clearAllMocks();
});

describe('scheduleTz utilities', () => {
  it('returns trimmed schedulesTz when configuration is valid', () => {
  mockedGetAppConfig.mockReturnValue(makeConfig({ schedulesTz: '  Europe/Berlin   ' }));

    const result = scheduleLib.resolveSchedulesTz();

    expect(result).toBe('Europe/Berlin');
  });

  it('logs and falls back to Intl resolved zone when config is invalid', () => {
  mockedGetAppConfig.mockReturnValue(makeConfig({ schedulesTz: 'Invalid/Zone' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dtSpy = mockDateTimeFormat({ intlTz: 'America/New_York', invalidZones: ['Invalid/Zone'] });

    const result = scheduleLib.resolveSchedulesTz();

    expect(result).toBe('America/New_York');
    expect(warnSpy).toHaveBeenCalledWith(
      '[scheduleTz]',
      'Invalid VITE_SCHEDULES_TZ configured; attempting Intl fallback.',
      'Invalid/Zone'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[scheduleTz]',
      'Using Intl resolved time zone due to invalid configuration.',
      'America/New_York'
    );

    dtSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('uses Intl resolved zone when configuration is empty', () => {
  mockedGetAppConfig.mockReturnValue(makeConfig({ schedulesTz: '   ' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dtSpy = mockDateTimeFormat({ intlTz: 'America/New_York' });

    const result = scheduleLib.resolveSchedulesTz();

    expect(result).toBe('America/New_York');
    expect(warnSpy).toHaveBeenCalledWith(
      '[scheduleTz]',
      'No VITE_SCHEDULES_TZ set. Using Intl resolved time zone.',
      'America/New_York'
    );

    dtSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('falls back to default timezone when nothing is resolvable', () => {
  mockedGetAppConfig.mockReturnValue(makeConfig({ schedulesTz: '' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dtSpy = mockDateTimeFormat({ intlTz: 'Bad/Tz', invalidZones: ['Bad/Tz'] });

    const result = scheduleLib.resolveSchedulesTz();

    expect(result).toBe('Asia/Tokyo');
    expect(warnSpy).toHaveBeenCalledWith(
      '[scheduleTz]',
      'Unable to resolve valid time zone; defaulting to Asia/Tokyo.',
      ''
    );

    dtSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('assertValidTz', () => {
    it('returns the provided timezone when valid', () => {
      expect(scheduleLib.assertValidTz('Asia/Tokyo', 'UTC')).toBe('Asia/Tokyo');
    });

    it('warns and returns fallback when provided timezone is invalid but fallback is valid', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dtSpy = mockDateTimeFormat({ invalidZones: ['Invalid/Zone'] });

      const result = scheduleLib.assertValidTz('Invalid/Zone', 'UTC');

      expect(result).toBe('UTC');
      expect(warnSpy).toHaveBeenCalledWith(
        '[scheduleTz] Invalid time zone "Invalid/Zone"; falling back to "UTC".'
      );

      dtSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('returns default timezone when neither value is valid', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const dtSpy = mockDateTimeFormat({ invalidZones: ['Invalid/Zone', 'Bad/Tz'] });

      const result = scheduleLib.assertValidTz('Invalid/Zone', 'Bad/Tz');

      expect(result).toBe('Asia/Tokyo');
      expect(warnSpy).toHaveBeenCalledWith(
        '[scheduleTz] Invalid time zone "Invalid/Zone"; falling back to "Bad/Tz".'
      );

      dtSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});
