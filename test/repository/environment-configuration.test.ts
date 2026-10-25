import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const catalog = readFileSync(
  resolve(root, 'docs/ENVIRONMENT_VARIABLES.md'),
  'utf8'
);

type VariableKind = 'browser' | 'server' | 'secret' | 'binding' | 'adapter';
type VariableStatus = 'runtime' | 'binding' | 'deployment-only';
type VariableSupply = 'template' | 'wrangler' | 'provider';

interface VariableAudit {
  name: string;
  kind: VariableKind;
  supply: VariableSupply;
  status: VariableStatus;
}

interface TurboDryRun {
  tasks: Array<{
    taskId: string;
    resolvedTaskDefinition: {
      dependsOn: string[];
      outputs: string[];
    };
  }>;
}

function templated(
  variables: readonly (readonly [string, VariableKind])[]
): VariableAudit[] {
  return variables.map(([name, kind]) => ({
    name,
    kind,
    supply: 'template',
    status: 'runtime',
  }));
}

function audited(
  variables: readonly (readonly [
    string,
    VariableKind,
    VariableSupply,
    VariableStatus,
  ])[]
): VariableAudit[] {
  return variables.map(([name, kind, supply, status]) => ({
    name,
    kind,
    supply,
    status,
  }));
}

const workspaceVariables = {
  web: {
    template: 'apps/web/.env.example',
    turboConfig: 'apps/web/turbo.json',
    variables: templated([
      ['BASE_DOMAIN', 'server'],
      ['CF_SECRET', 'secret'],
      ['MOODLE_URL', 'server'],
      ['NEXT_PUBLIC_SITE_URL', 'browser'],
      ['WORKER_URL', 'server'],
    ]),
  },
  people: {
    template: 'apps/people/.env.example',
    turboConfig: 'apps/people/turbo.json',
    variables: templated([
      ['NEXT_PUBLIC_PEOPLE_DATA_BASE_URL', 'browser'],
      ['NEXT_PUBLIC_PROJECTS_DATA_BASE_URL', 'browser'],
      ['NEXT_PUBLIC_PROJECTS_SITE_URL', 'browser'],
      ['NEXT_PUBLIC_SITE_URL', 'browser'],
    ]),
  },
  projects: {
    template: 'apps/projects/.env.example',
    turboConfig: 'apps/projects/turbo.json',
    variables: templated([
      ['NEXT_PUBLIC_DEPARTMENT_SITE_URL', 'browser'],
      ['NEXT_PUBLIC_PEOPLE_SITE_URL', 'browser'],
      ['NEXT_PUBLIC_PROJECTS_DATA_BASE_URL', 'browser'],
      ['NEXT_PUBLIC_SITE_URL', 'browser'],
    ]),
  },
  portal: {
    template: 'apps/portal/.env.example',
    turboConfig: 'apps/portal/turbo.json',
    variables: templated([
      ['COOKIE_DOMAIN', 'server'],
      ['NEXT_PUBLIC_API_CLIENT_ID', 'browser'],
      ['NEXT_PUBLIC_BASE_API_URL', 'browser'],
      ['NEXT_PUBLIC_PEOPLE_DATA_BASE_URL', 'browser'],
      ['NEXT_PUBLIC_SITE_URL', 'browser'],
      ['NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH', 'browser'],
    ]),
  },
  api: {
    template: 'services/api/.dev.vars.example',
    wrangler: 'services/api/wrangler.jsonc',
    variables: audited([
      ['BETTER_AUTH_SECRET', 'secret', 'template', 'runtime'],
      ['BETTER_AUTH_URL', 'server', 'wrangler', 'runtime'],
      ['DATA_PUBLIC_BASE_URL', 'server', 'wrangler', 'runtime'],
      ['GITHUB_APP', 'binding', 'wrangler', 'binding'],
      ['GITHUB_APP_API_URL', 'server', 'wrangler', 'runtime'],
      ['GITHUB_APP_INTERNAL_SECRET', 'secret', 'template', 'runtime'],
      ['GITHUB_CLIENT_ID', 'server', 'wrangler', 'runtime'],
      ['GITHUB_CLIENT_SECRET', 'secret', 'template', 'runtime'],
      ['GOOGLE_CLIENT_ID', 'server', 'wrangler', 'runtime'],
      ['GOOGLE_CLIENT_SECRET', 'secret', 'template', 'runtime'],
      ['MAILER_API_KEY', 'secret', 'template', 'runtime'],
      ['MAILER_API_URL', 'server', 'wrangler', 'runtime'],
      ['AUTH_DB', 'binding', 'wrangler', 'binding'],
    ]),
  },
  githubApp: {
    template: 'services/github-app/.env.example',
    wrangler: 'services/github-app/wrangler.jsonc',
    variables: audited([
      ['GITHUB_APP_ID', 'server', 'template', 'runtime'],
      ['GITHUB_INSTALLATION_ID', 'server', 'template', 'runtime'],
      ['GITHUB_OWNER', 'server', 'template', 'runtime'],
      ['GITHUB_PEOPLE_DATA_REPOSITORY', 'server', 'template', 'runtime'],
      ['GITHUB_PRIVATE_KEY', 'secret', 'template', 'runtime'],
      ['GITHUB_PROJECTS_DATA_REPOSITORY', 'server', 'template', 'runtime'],
      ['MUTATION_COORDINATOR', 'binding', 'wrangler', 'binding'],
      ['OPERATION_QUEUE', 'binding', 'wrangler', 'binding'],
      ['OPERATION_STATE', 'binding', 'wrangler', 'binding'],
      ['PORT', 'adapter', 'template', 'runtime'],
      ['X_INTERNAL_SECRET', 'secret', 'template', 'runtime'],
    ]),
  },
  mailer: {
    template: 'services/mailer/.env.example',
    variables: audited([
      ['MAILER_API_KEY', 'secret', 'template', 'runtime'],
      ['PORT', 'adapter', 'template', 'runtime'],
      ['SMTP_FROM', 'server', 'template', 'runtime'],
      ['SMTP_HOST', 'server', 'template', 'runtime'],
      ['SMTP_PASS', 'secret', 'template', 'runtime'],
      ['SMTP_SECURE', 'server', 'template', 'runtime'],
      ['SMTP_USER', 'secret', 'template', 'runtime'],
      [
        'VERCEL_EXPERIMENTAL_BACKENDS',
        'adapter',
        'provider',
        'deployment-only',
      ],
    ]),
  },
} as const;

function keysInTemplate(path: string): string[] {
  return readFileSync(resolve(root, path), 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.slice(0, line.indexOf('=')))
    .sort();
}

function readTurboConfig(path: string): {
  tasks: Record<string, { env?: string[] }>;
} {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as {
    tasks: Record<string, { env?: string[] }>;
  };
}

describe('environment configuration discovery', () => {
  for (const [workspace, audit] of Object.entries(workspaceVariables)) {
    test(`${workspace} lists its complete supported local configuration`, () => {
      const templatedVariables = audit.variables
        .filter((variable) => variable.supply !== 'wrangler')
        .map((variable) => variable.name)
        .sort();

      expect(keysInTemplate(audit.template)).toEqual(templatedVariables);
    });
  }

  test('the root catalog documents the kind, supply, and status of every supported value', () => {
    const catalogLines = catalog.split(/\r?\n/u);

    for (const audit of Object.values(workspaceVariables)) {
      for (const variable of audit.variables) {
        expect(
          catalogLines.some(
            (line) =>
              line.includes(`\`${variable.name}\``) &&
              line.includes(`\`${variable.kind}\``) &&
              line.includes(`\`${variable.supply}\``) &&
              line.includes(`\`${variable.status}\``)
          )
        ).toBe(true);
      }
    }
  });

  test('every Wrangler-supplied value or binding is declared by its owner', () => {
    for (const audit of Object.values(workspaceVariables)) {
      if (!('wrangler' in audit)) continue;
      const declaration = readFileSync(resolve(root, audit.wrangler), 'utf8');

      for (const variable of audit.variables.filter(
        (entry) => entry.supply === 'wrangler'
      )) {
        expect(declaration).toContain(`\"${variable.name}\"`);
      }
    }
  });

  test('classifies platform bindings and deployment-only adapter settings explicitly', () => {
    const variables = Object.values(workspaceVariables).flatMap(
      (audit) => audit.variables
    );
    const bindings = variables
      .filter((variable) => variable.status === 'binding')
      .map((variable) => variable.name)
      .sort();

    expect(bindings).toEqual([
      'AUTH_DB',
      'GITHUB_APP',
      'MUTATION_COORDINATOR',
      'OPERATION_QUEUE',
      'OPERATION_STATE',
    ]);
    expect(
      variables.find(
        (variable) => variable.name === 'VERCEL_EXPERIMENTAL_BACKENDS'
      )
    ).toMatchObject({ status: 'deployment-only', supply: 'provider' });
  });

  test('declares every Next.js build input on its owning Turborepo task', () => {
    for (const audit of Object.values(workspaceVariables)) {
      if (!('turboConfig' in audit)) continue;
      const turbo = readTurboConfig(audit.turboConfig);

      expect(turbo.tasks.build?.env?.slice().sort()).toEqual(
        audit.variables.map((variable) => variable.name).sort()
      );
    }
  });

  test('restores every Next.js build artifact from the Turborepo cache', () => {
    const result = Bun.spawnSync({
      cmd: ['bunx', 'turbo', 'run', 'build', '--dry=json'],
      cwd: root,
      stderr: 'pipe',
      stdout: 'pipe',
    });

    expect(result.exitCode).toBe(0);

    const dryRun = JSON.parse(result.stdout.toString()) as TurboDryRun;
    const nextBuildTasks = [
      '@scs/people#build',
      '@scs/portal#build',
      '@scs/projects#build',
      '@scs/web#build',
    ];

    for (const taskId of nextBuildTasks) {
      const task = dryRun.tasks.find(
        (candidate) => candidate.taskId === taskId
      );

      expect(task?.resolvedTaskDefinition.outputs).toContain('.next/**');
      expect(task?.resolvedTaskDefinition.dependsOn).toContain('^build');
    }
  });
});
