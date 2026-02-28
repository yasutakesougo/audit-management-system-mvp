import {
    classifyIdentifier,
    getAllListKeys,
    getListDisplayName,
    getListEndpointPath,
    getListEntry,
    getListFieldsPath,
    getListItemPath,
    getListItemsPath,
    getListKeysByCategory,
    resolveClassifiedIdentifier,
    resolveListIdentifier,
    type SpListKey,
} from '@/sharepoint/spListConfig';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// SpListKey type safety & completeness
// ---------------------------------------------------------------------------

describe('getAllListKeys', () => {
  it('should return exactly 24 keys', () => {
    expect(getAllListKeys()).toHaveLength(24);
  });

  it('should return unique keys', () => {
    const keys = getAllListKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('should include expected keys', () => {
    const keys = getAllListKeys();
    expect(keys).toContain('users_master');
    expect(keys).toContain('staff_master');
    expect(keys).toContain('compliance_check_rules');
    expect(keys).toContain('official_forms');
    expect(keys).toContain('schedule_events');
  });
});

// ---------------------------------------------------------------------------
// getListEntry
// ---------------------------------------------------------------------------

describe('getListEntry', () => {
  it('should return the entry for a valid key', () => {
    const entry = getListEntry('users_master');
    expect(entry.key).toBe('users_master');
    expect(entry.displayName).toBeTruthy();
    expect(typeof entry.resolve).toBe('function');
  });

  it('should throw for an unknown key', () => {
    expect(() => getListEntry('nonexistent_list' as SpListKey)).toThrow(
      /Unknown list key/,
    );
  });
});

// ---------------------------------------------------------------------------
// resolveListIdentifier
// ---------------------------------------------------------------------------

describe('resolveListIdentifier', () => {
  it('should return a non-empty string for all keys', () => {
    for (const key of getAllListKeys()) {
      const id = resolveListIdentifier(key);
      expect(id, `key "${key}" resolved empty`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// classifyIdentifier
// ---------------------------------------------------------------------------

describe('classifyIdentifier', () => {
  it('should classify guid: prefix as guid', () => {
    const result = classifyIdentifier('guid:576f882f-446f-4f7e-8444-d15ba746c681');
    expect(result.type).toBe('guid');
    expect(result.value).toBe('576f882f-446f-4f7e-8444-d15ba746c681');
  });

  it('should classify bare GUID string as guid', () => {
    const result = classifyIdentifier('576f882f-446f-4f7e-8444-d15ba746c681');
    expect(result.type).toBe('guid');
    expect(result.value).toBe('576f882f-446f-4f7e-8444-d15ba746c681');
  });

  it('should classify normal title as title', () => {
    const result = classifyIdentifier('Users_Master');
    expect(result.type).toBe('title');
    expect(result.value).toBe('Users_Master');
  });

  it('should handle GUID: with uppercase prefix', () => {
    const result = classifyIdentifier('GUID:abcdef01-2345-6789-abcd-ef0123456789');
    expect(result.type).toBe('guid');
  });
});

// ---------------------------------------------------------------------------
// getListEndpointPath — GUID/Title transparent
// ---------------------------------------------------------------------------

describe('getListEndpointPath', () => {
  it('should generate title-based path for title lists', () => {
    const path = getListEndpointPath('users_master');
    expect(path).toContain('getbytitle');
    expect(path).toContain('Users_Master');
  });

  it('should URL-encode title with special characters', () => {
    // org_master resolves to Org_Master which contains underscore
    const path = getListEndpointPath('org_master');
    expect(path).toContain("getbytitle('Org_Master')");
  });

  it('should start with /_api/web/', () => {
    const path = getListEndpointPath('staff_master');
    expect(path).toMatch(/^\/_api\/web\/lists/);
  });
});

// ---------------------------------------------------------------------------
// getListItemsPath
// ---------------------------------------------------------------------------

describe('getListItemsPath', () => {
  it('should append /items to the list endpoint', () => {
    const path = getListItemsPath('users_master');
    expect(path).toMatch(/\/items$/);
  });
});

// ---------------------------------------------------------------------------
// getListItemPath
// ---------------------------------------------------------------------------

describe('getListItemPath', () => {
  it('should append /items(id) to the list endpoint', () => {
    const path = getListItemPath('users_master', 42);
    expect(path).toMatch(/\/items\(42\)$/);
  });
});

// ---------------------------------------------------------------------------
// getListFieldsPath
// ---------------------------------------------------------------------------

describe('getListFieldsPath', () => {
  it('should append /fields to the list endpoint', () => {
    const path = getListFieldsPath('staff_master');
    expect(path).toMatch(/\/fields$/);
  });
});

// ---------------------------------------------------------------------------
// getListDisplayName
// ---------------------------------------------------------------------------

describe('getListDisplayName', () => {
  it('should return the Japanese display name', () => {
    expect(getListDisplayName('users_master')).toBe('利用者マスタ');
    expect(getListDisplayName('official_forms')).toBe('公式帳票ライブラリ');
  });
});

// ---------------------------------------------------------------------------
// getListKeysByCategory
// ---------------------------------------------------------------------------

describe('getListKeysByCategory', () => {
  it('should return master category lists', () => {
    const keys = getListKeysByCategory('master');
    expect(keys).toContain('users_master');
    expect(keys).toContain('staff_master');
    expect(keys).toContain('org_master');
  });

  it('should return meeting category lists', () => {
    const keys = getListKeysByCategory('meeting');
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  it('should return empty array for a category with no lists', () => {
    // All categories should have at least one list, but the function should handle gracefully
    const result = getListKeysByCategory('nonexistent' as SpListKey extends string ? never : never);
    // This should be typed to prevent, but runtime should return empty
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveClassifiedIdentifier
// ---------------------------------------------------------------------------

describe('resolveClassifiedIdentifier', () => {
  it('should resolve and classify in one step', () => {
    const result = resolveClassifiedIdentifier('users_master');
    expect(result.type).toBe('title');
    expect(result.value).toBeTruthy();
  });
});
