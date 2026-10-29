import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(
  resolve(
    import.meta.dir,
    '../../.github/workflows/publish-schemas-package.yml'
  ),
  'utf8'
);

describe('private schemas package publishing', () => {
  test('publishes verified main builds with narrow permissions', () => {
    expect(workflow).toMatch(/push:\s+branches:\s+- main/);
    expect(workflow).toContain("- 'packages/schemas/**'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('packages: write');
    expect(workflow).toContain('uses: actions/checkout@v7');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2');
    expect(workflow).toContain("bun --filter '@scs/schemas' lint");
    expect(workflow).toContain("bun --filter '@scs/schemas' typecheck");
    expect(workflow).toContain("bun --filter '@scs/schemas' test");
    expect(workflow).toContain("bun --filter '@scs/schemas' build");
    expect(workflow).toContain(
      'SCHEMAS_VERSION: 0.${{ github.run_number }}.${{ github.run_attempt }}'
    );
    expect(workflow).toContain('npm publish packages/schemas/package');
    expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ github.token }}');
    expect(workflow).toContain(
      'NPM_CONFIG_USERCONFIG: ${{ runner.temp }}/schemas-package.npmrc'
    );
    expect(workflow).toContain(
      "'//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}'"
    );
  });
});
