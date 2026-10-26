import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const checker = resolve(
  import.meta.dir,
  '../../scripts/check-documentation.mts'
);
const fixtures: string[] = [];

async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scs-docs-check-'));
  fixtures.push(root);

  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await Bun.write(target, content);
  }

  Bun.spawnSync(['git', 'init', '--quiet'], { cwd: root });
  Bun.spawnSync(['git', 'add', '.'], { cwd: root });
  return root;
}

function runChecker(root: string) {
  const result = Bun.spawnSync(['bun', checker, '--root', root], {
    cwd: root,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((path) => rm(path, { recursive: true }))
  );
});

describe('documentation policy checker', () => {
  test('accepts root README, AGENTS, and uppercase snake-case docs', async () => {
    const root = await createFixture({
      'README.md':
        '# Example\n\nSee [agents](AGENTS.md) and [architecture](docs/ARCHITECTURE.md).\n',
      'AGENTS.md': '# Agent Instructions\n',
      'docs/ARCHITECTURE.md':
        '---\ntitle: Architecture\ndescription: System design.\n---\n\n# Architecture\n',
      'docs/meta.json': JSON.stringify({ pages: ['ARCHITECTURE'] }),
    });

    const result = runChecker(root);

    expect(result).toEqual({ exitCode: 0, output: '' });
  });

  test('rejects tracked Markdown outside the root documentation directory', async () => {
    const root = await createFixture({
      'README.md': '# Example\n',
      'apps/portal/README.md': '# Portal\n',
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('apps/portal/README.md');
    expect(result.output).toContain(
      'must be README.md, AGENTS.md, or live under docs/'
    );
  });

  test('rejects Markdown filenames that are not uppercase snake case', async () => {
    const root = await createFixture({
      'README.md': '# Example\n',
      'docs/api-reference.md': '# API\n',
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('docs/api-reference.md');
    expect(result.output).toContain('uppercase snake case');
  });

  test('rejects links to missing local Markdown files', async () => {
    const root = await createFixture({
      'README.md': '# Example\n\nSee [missing](docs/MISSING.md).\n',
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('docs/MISSING.md');
    expect(result.output).toContain('does not exist');
  });

  test('ignores tracked Markdown removed from the working tree', async () => {
    const root = await createFixture({
      'README.md': '# Example\n',
      'apps/portal/README.md': '# Removed\n',
    });
    await rm(join(root, 'apps/portal/README.md'));

    const result = runChecker(root);

    expect(result).toEqual({ exitCode: 0, output: '' });
  });

  test('checks untracked Markdown in the working tree', async () => {
    const root = await createFixture({
      'README.md': '# Example\n',
    });
    await mkdir(join(root, 'docs'), { recursive: true });
    await Bun.write(join(root, 'docs/lowercase.md'), '# New file\n');

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('docs/lowercase.md');
  });

  test('rejects documentation that is not discoverable from README', async () => {
    const root = await createFixture({
      'README.md': '# Example\n',
      'docs/OPERATIONS.md': '# Operations\n',
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('docs/OPERATIONS.md');
    expect(result.output).toContain('not linked from README.md');
  });

  test('rejects documentation without complete frontmatter', async () => {
    const root = await createFixture({
      'README.md': '# Example\n\nSee [index](docs/INDEX.md).\n',
      'docs/INDEX.md': '# Handbook\n',
      'docs/meta.json': JSON.stringify({ pages: ['INDEX'] }),
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('docs/INDEX.md');
    expect(result.output).toContain('title and description frontmatter');
  });

  test('rejects documentation without exactly one visible H1', async () => {
    const root = await createFixture({
      'README.md': '# Example\n\nSee [index](docs/INDEX.md).\n',
      'docs/INDEX.md':
        '---\ntitle: Handbook\ndescription: Example handbook.\n---\n\nText only.\n',
      'docs/meta.json': JSON.stringify({ pages: ['INDEX'] }),
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('exactly one visible H1');
  });

  test('rejects missing and duplicate navigation entries', async () => {
    const page =
      '---\ntitle: Handbook\ndescription: Example handbook.\n---\n\n# Handbook\n';
    const root = await createFixture({
      'README.md':
        '# Example\n\nSee [index](docs/INDEX.md) and [other](docs/OTHER.md).\n',
      'docs/INDEX.md': page,
      'docs/OTHER.md': page,
      'docs/meta.json': JSON.stringify({ pages: ['INDEX', 'INDEX'] }),
    });

    const result = runChecker(root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('duplicate navigation entry INDEX');
    expect(result.output).toContain(
      'docs/OTHER.md: missing from docs/meta.json'
    );
  });
});
