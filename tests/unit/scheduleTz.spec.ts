import { describe, expect, it, vi } from 'vitest';
import { suppressConsoleDuring } from './_helpers/consoleSpyHelper';
import { mergeTestConfig, setTestConfigOverride } from '../helpers/mockEnv';
import { installTestResets } from '../helpers/reset';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: vi.fn(() => mergeTestConfig()),
  };
});

const RealDateTimeFormat = Intl.DateTimeFormat;

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

const scheduleLib = await import('@/utils/scheduleTz');

describe('scheduleTz utilities', () => {
  installTestResets();

  it('returns trimmed schedulesTz when configuration is valid', () => {
    setTestConfigOverride({ schedulesTz: '  Europe/Berlin   ' });

    const result = scheduleLib.resolveSchedulesTz();

    expect(result).toBe('Europe/Berlin');
  });

  it('logs and falls back to Intl resolved zone when config is invalid', async () => {
    setTestConfigOverride({ schedulesTz: 'Invalid/Zone' });

    const dtSpy = mockDateTimeFormat({ intlTz: 'America/New_York', invalidZones: ['Invalid/Zone'] });

    await suppressConsoleDuring('warn', () => {
      const result = scheduleLib.resolveSchedulesTz();
      expect(result).toBe('America/New_York');
    }, /Invalid VITE_SCHEDULES_TZ configured; attempting Intl fallback.*Using Intl resolved time zone due to invalid configuration/s);

    dtSpy.mockRestore();
  });

  it('uses Intl resolved zone when configuration is empty', async () => {
    setTestConfigOverride({ schedulesTz: '   ' });

    const dtSpy = mockDateTimeFormat({ intlTz: 'America/New_York' });

    await suppressConsoleDuring('warn', () => {
      const result = scheduleLib.resolveSchedulesTz();
      expect(result).toBe('America/New_York');
    }, /No VITE_SCHEDULES_TZ set. Using Intl resolved time zone/);

    dtSpy.mockRestore();
  });

  it('falls back to default timezone when nothing is resolvable', async () => {
    setTestConfigOverride({ schedulesTz: '' });

    const dtSpy = mockDateTimeFormat({ intlTz: 'Bad/Tz', invalidZones: ['Bad/Tz', 'America/New_York'] });

    await suppressConsoleDuring('warn', () => {
      const result = scheduleLib.resolveSchedulesTz();
      expect(result).toBe('Asia/Tokyo');
    }, /Unable to resolve valid time zone; defaulting to Asia\/Tokyo/);

    dtSpy.mockRestore();
  });

  describe('assertValidTz', () => {
    it('returns the provided timezone when valid', () => {
      expect(scheduleLib.assertValidTz('Asia/Tokyo', 'UTC')).toBe('Asia/Tokyo');
    });

    it('warns and returns fallback when provided timezone is invalid but fallback is valid', async () => {
      const dtSpy = mockDateTimeFormat({ invalidZones: ['Invalid/Zone', 'America/New_York', 'Asia/Tokyo'] });

      await suppressConsoleDuring('warn', () => {
        const result = scheduleLib.assertValidTz('Invalid/Zone', 'UTC');
        expect(result).toBe('UTC');
      }, /Invalid time zone "Invalid\/Zone"; falling back to "UTC"/);

      dtSpy.mockRestore();
    });

    it('returns default timezone when neither value is valid', async () => {
      const dtSpy = mockDateTimeFormat({ invalidZones: ['Invalid/Zone', 'Bad/Tz', 'America/New_York'] });

      await suppressConsoleDuring('warn', () => {
        const result = scheduleLib.assertValidTz('Invalid/Zone', 'Bad/Tz');
        expect(result).toBe('Asia/Tokyo');
      }, /Invalid time zone "Invalid\/Zone"; falling back to "Bad\/Tz"/);

      dtSpy.mockRestore();
    });
  });
});
