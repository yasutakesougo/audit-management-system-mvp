/**
 * TransportMethod Utilities Unit Tests
 */

import { describe, expect, it } from 'vitest';
import {
    inferMethodFromBool,
    isTransportMethod,
    methodImpliesShuttle,
    parseTransportMethod,
    resolveFromMethod,
    resolveToMethod,
    TRANSPORT_METHOD_LABEL,
    TRANSPORT_METHODS,
    type TransportMethod,
} from '../transportMethod';

describe('inferMethodFromBool', () => {
  it('true → office_shuttle', () => {
    expect(inferMethodFromBool(true)).toBe('office_shuttle');
  });

  it('false → self', () => {
    expect(inferMethodFromBool(false)).toBe('self');
  });
});

describe('methodImpliesShuttle', () => {
  it('office_shuttle → true', () => {
    expect(methodImpliesShuttle('office_shuttle')).toBe(true);
  });

  it.each<TransportMethod>(['self', 'guide_helper', 'family', 'other'])(
    '%s → false',
    (method) => {
      expect(methodImpliesShuttle(method)).toBe(false);
    },
  );
});

describe('resolveToMethod', () => {
  const shuttleUser = {
    isTransportTarget: true,
  };

  const selfUser = {
    isTransportTarget: false,
  };

  it('visit.transportToMethod が優先される', () => {
    const visit = {
      transportTo: false,
      transportFrom: false,
      transportToMethod: 'family' as TransportMethod,
    };
    expect(resolveToMethod(shuttleUser, visit)).toBe('family');
  });

  it('visit.transportToMethod がなければ boolean から推定', () => {
    const visit = {
      transportTo: true,
      transportFrom: false,
    };
    expect(resolveToMethod(selfUser, visit)).toBe('office_shuttle');
  });

  it('visit がなければ user.defaultTransportToMethod', () => {
    const user = {
      isTransportTarget: true,
      defaultTransportToMethod: 'guide_helper' as TransportMethod,
    };
    expect(resolveToMethod(user)).toBe('guide_helper');
  });

  it('visit なし＋default なし＋isTransportTarget=true → office_shuttle', () => {
    expect(resolveToMethod(shuttleUser)).toBe('office_shuttle');
  });

  it('visit なし＋default なし＋isTransportTarget=false → self', () => {
    expect(resolveToMethod(selfUser)).toBe('self');
  });

  it('visit undefined（明示的に渡す場合）', () => {
    expect(resolveToMethod(shuttleUser, undefined)).toBe('office_shuttle');
  });
});

describe('resolveFromMethod', () => {
  const shuttleUser = {
    isTransportTarget: true,
  };

  it('visit.transportFromMethod が優先される', () => {
    const visit = {
      transportTo: false,
      transportFrom: true,
      transportFromMethod: 'other' as TransportMethod,
    };
    expect(resolveFromMethod(shuttleUser, visit)).toBe('other');
  });

  it('visit.transportFromMethod がなければ boolean から推定', () => {
    const visit = {
      transportTo: false,
      transportFrom: true,
    };
    expect(resolveFromMethod(shuttleUser, visit)).toBe('office_shuttle');
  });

  it('visit なし＋defaultFrom あり', () => {
    const user = {
      isTransportTarget: false,
      defaultTransportFromMethod: 'family' as TransportMethod,
    };
    expect(resolveFromMethod(user)).toBe('family');
  });
});

describe('isTransportMethod', () => {
  it.each(TRANSPORT_METHODS)('%s は valid', (method) => {
    expect(isTransportMethod(method)).toBe(true);
  });

  it('無効な値は false', () => {
    expect(isTransportMethod('invalid')).toBe(false);
    expect(isTransportMethod(null)).toBe(false);
    expect(isTransportMethod(undefined)).toBe(false);
    expect(isTransportMethod(123)).toBe(false);
    expect(isTransportMethod('')).toBe(false);
  });
});

describe('parseTransportMethod', () => {
  it('有効な値は TransportMethod を返す', () => {
    expect(parseTransportMethod('self')).toBe('self');
    expect(parseTransportMethod('office_shuttle')).toBe('office_shuttle');
  });

  it('無効な値は undefined を返す', () => {
    expect(parseTransportMethod('invalid')).toBeUndefined();
    expect(parseTransportMethod(null)).toBeUndefined();
    expect(parseTransportMethod(42)).toBeUndefined();
  });
});

describe('TRANSPORT_METHOD_LABEL', () => {
  it('全 method にラベルが定義されている', () => {
    for (const method of TRANSPORT_METHODS) {
      expect(TRANSPORT_METHOD_LABEL[method]).toBeTruthy();
      expect(typeof TRANSPORT_METHOD_LABEL[method]).toBe('string');
    }
  });
});
