import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

const DOCUMENT_NAME = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\.md$/;
const MARKDOWN_LINK = /!?\[[^\]]*\]\(([^)]+)\)/g;

function repositoryRoot(): string {
  const rootArgument = process.argv.indexOf('--root');
  if (rootArgument === -1) return resolve(import.meta.dir, '..');

  const root = process.argv[rootArgument + 1];
  if (!root) throw new Error('--root requires a directory');
  return resolve(root);
}

function trackedMarkdown(root: string): string[] {
  const result = Bun.spawnSync(
    [
      'git',
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.md',
    ],
    {
      cwd: root,
      stderr: 'pipe',
      stdout: 'pipe',
    }
  );

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || 'git ls-files failed');
  }

  return [
    ...new Set(
      result.stdout
        .toString()
        .split(/\r?\n/)
        .map((path) => path.trim().replaceAll('\\', '/'))
        .filter((path) => path && existsSync(resolve(root, path)))
    ),
  ];
}

function localMarkdownTarget(
  root: string,
  source: string,
  rawTarget: string
): string | null {
  const target = rawTarget
    .trim()
    .replace(/^<|>$/g, '')
    .split(/\s+['"]/)[0];
  if (
    !target ||
    target.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) {
    return null;
  }

  const withoutFragment = target.split(/[?#]/, 1)[0];
  if (!withoutFragment.toLowerCase().endsWith('.md')) return null;

  const decoded = decodeURIComponent(withoutFragment);
  return decoded.startsWith('/')
    ? resolve(root, decoded.slice(1))
    : resolve(root, dirname(source), decoded);
}

function documentationViolations(root: string, paths: string[]): string[] {
  const violations: string[] = [];
  const readme = resolve(root, 'README.md');
  const documentedPaths = new Set<string>();

  if (existsSync(readme)) {
    const content = readFileSync(readme, 'utf8');
    for (const match of content.matchAll(MARKDOWN_LINK)) {
      const target = localMarkdownTarget(root, 'README.md', match[1]);
      if (!target) continue;
      documentedPaths.add(relative(root, target).replaceAll('\\', '/'));
    }
  }

  for (const path of paths) {
    const normalized = path.replaceAll('\\', '/');
    const allowedLocation =
      normalized === 'README.md' ||
      normalized === 'AGENTS.md' ||
      normalized.startsWith('docs/');

    if (!allowedLocation) {
      violations.push(
        `${normalized}: tracked Markdown must be README.md, AGENTS.md, or live under docs/`
      );
      continue;
    }

    if (!DOCUMENT_NAME.test(basename(normalized))) {
      violations.push(
        `${normalized}: Markdown filename must use uppercase snake case`
      );
    }

    if (normalized !== 'README.md' && !documentedPaths.has(normalized)) {
      violations.push(
        `${normalized}: Markdown file is not linked from README.md`
      );
    }

    const sourcePath = resolve(root, normalized);
    const content = readFileSync(sourcePath, 'utf8');
    for (const match of content.matchAll(MARKDOWN_LINK)) {
      const target = localMarkdownTarget(root, normalized, match[1]);
      if (!target) continue;

      const relativeTarget = relative(root, target).replaceAll('\\', '/');
      if (
        relativeTarget.startsWith('../') ||
        isAbsolute(relativeTarget) ||
        !existsSync(target)
      ) {
        violations.push(
          `${normalized}: local Markdown link ${match[1]} does not exist`
        );
      }
    }
  }

  return violations;
}

const root = repositoryRoot();
const violations = documentationViolations(root, trackedMarkdown(root));

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
