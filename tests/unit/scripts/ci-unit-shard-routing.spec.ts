import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CI unit shard routing', () => {
  it('passes the matrix shard to Vitest instead of the trailing Node test command', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const workflow = readFileSync(
      resolve(process.cwd(), '.github/workflows/ci.yml'),
      'utf8',
    );

    expect(packageJson.scripts['test:ci']).toContain('--shard=${TEST_SHARD:-1/1}');
    expect(workflow).toContain(
      'TEST_SHARD=${{ matrix.shard }}/3 npm run test:ci',
    );
    expect(workflow).not.toContain(
      'npm run test:ci -- --shard=${{ matrix.shard }}/3',
    );
  });
});
