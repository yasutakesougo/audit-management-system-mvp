import { describe, expect, it } from 'vitest';
import { SP_LIST_REGISTRY, listDefinitions as registryDefinitions } from '../spListRegistry';
import { listDefinitions } from '../spListRegistry.definitions';

describe('spListRegistry SSOT', () => {
  it('uses definitions module as the single source of truth', () => {
    expect(registryDefinitions).toBe(listDefinitions);
    expect(SP_LIST_REGISTRY).toBe(listDefinitions);
  });
});
