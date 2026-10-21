import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Project } from '@scs/schemas';

import * as clientConfig from '@/config/client.config';
import {
  parseRuntimeConfig,
  runWithRuntimeConfig,
} from '@/config/runtime.config';
import { upsertPublicAcademicPr } from '@/repositories/public-course.repo';
import { upsertPublicProfilePr } from '@/repositories/public-profile.repo';
import { upsertPublicProjectPr } from '@/repositories/public-project.repo';

type CallCounts = Record<string, number>;

const runtimeConfig = parseRuntimeConfig({
  GITHUB_APP_ID: '123',
  GITHUB_PRIVATE_KEY: 'private-key',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_OWNER: 'scs-pdn',
  GITHUB_PEOPLE_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  GITHUB_PROJECTS_DATA_REPOSITORY: 'data.scs.pdn.ac.lk',
  X_INTERNAL_SECRET: 'internal-secret',
  PORT: '3000',
});

interface PullRecord {
  number: number;
  html_url: string;
  body: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  head: { ref: string; sha: string; repo: { full_name: string } };
  labels: Array<{ name: string }>;
}

function createGithubHarness() {
  const calls: CallCounts = {};
  const branches = new Map<
    string,
    Map<string, { content: string; sha: string }>
  >([['main', new Map()]]);
  const pulls: PullRecord[] = [];
  let sequence = 0;

  function count(name: string) {
    calls[name] = (calls[name] ?? 0) + 1;
  }

  function branchFiles(ref?: string) {
    return branches.get(ref ?? 'main') ?? branches.get('main')!;
  }

  const octokit = {
    repos: {
      get: async () => {
        count('repos.get');
        return { data: { default_branch: 'main' } };
      },
      getContent: async ({ path, ref }: { path: string; ref?: string }) => {
        count('repos.getContent');
        const files = branchFiles(ref);
        if (!path.endsWith('.json')) {
          const prefix = `${path}/`;
          return {
            data: [...files.keys()]
              .filter((name) => name.startsWith(prefix))
              .map((name) => ({
                type: 'file',
                name: name.slice(prefix.length),
              })),
          };
        }
        const file = files.get(path);
        if (!file) throw { status: 404 };
        return {
          data: {
            content: Buffer.from(file.content).toString('base64'),
            sha: file.sha,
          },
        };
      },
      createOrUpdateFileContents: async ({
        path,
        branch,
        content,
      }: {
        path: string;
        branch: string;
        content: string;
      }) => {
        count('repos.createOrUpdateFileContents');
        const sha = `commit-${++sequence}`;
        branchFiles(branch).set(path, {
          content: Buffer.from(content, 'base64').toString('utf8'),
          sha,
        });
        return { data: { commit: { sha } } };
      },
    },
    git: {
      getRef: async ({ ref }: { ref: string }) => {
        count('git.getRef');
        const branch = ref.replace(/^heads\//, '');
        if (branch !== 'main' && !branches.has(branch)) throw { status: 404 };
        const latest = [...branchFiles(branch).values()].at(-1)?.sha;
        return { data: { object: { sha: latest ?? 'base-sha' } } };
      },
      updateRef: async ({ ref, sha }: { ref: string; sha: string }) => {
        count('git.updateRef');
        const branch = ref.replace(/^heads\//, '');
        if (!branches.has(branch)) throw { status: 404 };
        branches.set(
          branch,
          new Map(branchFiles(sha === 'base-sha' ? 'main' : branch))
        );
        return { data: {} };
      },
      createRef: async ({ ref }: { ref: string; sha: string }) => {
        count('git.createRef');
        const branch = ref.replace(/^refs\/heads\//, '');
        if (branches.has(branch))
          throw { status: 422, message: 'Reference already exists' };
        branches.set(branch, new Map(branchFiles('main')));
        return { data: {} };
      },
      deleteRef: async () => {
        count('git.deleteRef');
        return { data: {} };
      },
    },
    pulls: {
      list: async ({ state }: { state: 'open' | 'closed' | 'all' }) => {
        count('pulls.list');
        return {
          data: pulls.filter((pull) => state === 'all' || pull.state === state),
        };
      },
      create: async ({ head, body }: { head: string; body: string }) => {
        count('pulls.create');
        const pull: PullRecord = {
          number: pulls.length + 1,
          html_url: `https://github.test/pulls/${pulls.length + 1}`,
          body,
          state: 'open',
          merged_at: null,
          updated_at: '2026-10-19T00:00:00.000Z',
          head: {
            ref: head,
            sha: [...branchFiles(head).values()].at(-1)?.sha ?? 'base-sha',
            repo: { full_name: '/' },
          },
          labels: [],
        };
        pulls.push(pull);
        return { data: pull };
      },
      update: async () => {
        count('pulls.update');
        return { data: {} };
      },
      get: async () => {
        count('pulls.get');
        return { data: pulls[0] };
      },
    },
    issues: {
      addLabels: async () => {
        count('issues.addLabels');
        return { data: {} };
      },
      createComment: async () => {
        count('issues.createComment');
        return { data: {} };
      },
    },
  };

  return { calls, octokit };
}

const project = {
  id: 'prj-example',
  slug: 'example',
  title: 'Example Project',
  shortDescription: 'An example project.',
  description: 'An example project used to characterize GitHub calls.',
  projectType: 'OTHER',
  status: 'ACTIVE',
  categories: ['example'],
  tags: ['example'],
  departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
  people: [{ name: 'Example Person', role: 'contributor' }],
  links: {},
  source: { kind: 'MANUAL', curator: 'SCS' },
  media: { icon: 'FolderKanban' },
  dates: { lastUpdatedAt: '2026-10-19' },
} as Project;

let restore: (() => void) | undefined;

beforeEach(() => {
  restore = undefined;
});

afterEach(() => restore?.());

describe('GitHub mutation call characterization', () => {
  test('records the current call volume for each mutation family', async () => {
    const harness = createGithubHarness();
    const getOctokitSpy = spyOn(clientConfig, 'getOctokit').mockReturnValue(
      harness.octokit as never
    );
    restore = () => getOctokitSpy.mockRestore();

    const snapshots: Record<string, CallCounts> = {};
    const snapshot = (name: string) => {
      snapshots[name] = { ...harness.calls };
      for (const key of Object.keys(harness.calls)) delete harness.calls[key];
    };

    await runWithRuntimeConfig(runtimeConfig, async () => {
      await upsertPublicAcademicPr({
        kind: 'course',
        id: 'csc3213',
        updatedBy: 'admin@pdn.ac.lk',
        recordPath: 'public/academic/v2/courses/csc3213.json',
        aggregatePath: 'public/academic/v2/courses.json',
        record: { id: 'csc3213', title: 'Software Engineering Project' },
      });
      snapshot('course');

      await upsertPublicAcademicPr({
        kind: 'offering',
        id: 'csc3213-2026',
        updatedBy: 'admin@pdn.ac.lk',
        recordPath: 'public/academic/v2/offerings/csc3213-2026.json',
        aggregatePath: 'public/academic/v2/offerings.json',
        record: { id: 'csc3213-2026', title: 'CSC3213 2026' },
      });
      snapshot('offering');

      await upsertPublicProjectPr({
        slug: 'example',
        updatedBy: 'admin@pdn.ac.lk',
        projectPath: 'public/projects/v2/projects/example.json',
        aggregatePath: 'public/projects/v2/projects.json',
        manifestPath: 'public/projects/v2/manifest.json',
        project,
      });
      snapshot('project');

      await upsertPublicProfilePr({
        username: 'academic',
        updatedBy: 'admin@pdn.ac.lk',
        profileKind: 'academic',
        userPath: 'public/people/v2/users/academic.json',
        aggregatePaths: ['public/people/v2/staff/academic.json'],
        profile: {
          title: 'Dr',
          fullName: 'Example Academic',
          email: 'academic@pdn.ac.lk',
          staffType: 'ACADEMIC_TEACHING',
          academicRank: 'LECTURER',
        },
      });
      snapshot('profile');
    });

    expect(snapshots).toEqual({
      course: {
        'git.createRef': 1,
        'git.getRef': 1,
        'git.updateRef': 1,
        'issues.addLabels': 2,
        'pulls.create': 1,
        'pulls.list': 2,
        'repos.createOrUpdateFileContents': 2,
        'repos.get': 1,
        'repos.getContent': 4,
      },
      offering: {
        'git.createRef': 1,
        'git.getRef': 1,
        'git.updateRef': 1,
        'issues.addLabels': 2,
        'pulls.create': 1,
        'pulls.list': 2,
        'repos.createOrUpdateFileContents': 2,
        'repos.get': 1,
        'repos.getContent': 4,
      },
      project: {
        'git.createRef': 1,
        'git.getRef': 1,
        'git.updateRef': 1,
        'issues.addLabels': 2,
        'pulls.create': 1,
        'pulls.list': 2,
        'repos.createOrUpdateFileContents': 3,
        'repos.get': 1,
        'repos.getContent': 6,
      },
      profile: {
        'git.createRef': 1,
        'git.getRef': 2,
        'issues.addLabels': 2,
        'pulls.create': 1,
        'pulls.list': 1,
        'repos.createOrUpdateFileContents': 3,
        'repos.get': 1,
        'repos.getContent': 35,
      },
    });
  });
});
