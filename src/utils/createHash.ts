import { canonicalJSONStringify } from '@/lib/hashUtil';

const FNV_OFFSET_BASIS_64 = BigInt('0xcbf29ce484222325');
const FNV_PRIME_64 = BigInt('0x100000001b3');
const UINT64_MAX = BigInt('0x10000000000000000');

export function createHash(payload: unknown): string {
  const normalized = canonicalJSONStringify(payload ?? null);
  let hash = FNV_OFFSET_BASIS_64;

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= BigInt(normalized.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) % UINT64_MAX;
  }

  return hash.toString(16).padStart(16, '0');
}
