import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';

interface FileEntry {
  content: string;
  sha?: string;
}

export interface StudentPlacementPrStatus {
  status: 'none' | 'open' | 'merged' | 'closed';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  canEdit: boolean;
  updatedAt?: string;
}

export interface StudentPlacementPrCleanupResult {
  closed: number;
}

export interface UpdateStudentPlacementInput {
  updatedBy: string;
  placement: unknown[];
  alumni: unknown[];
  postgraduateProgrammes: unknown[];
  studentStreams: unknown[];
}

const FILES = {
  placement: 'public/people/v2/student-placement.json',
  alumni: 'public/people/v2/alumni.json',
  postgraduateProgrammes: 'public/people/v2/postgraduate-programmes.json',
  studentStreams: 'public/people/v2/student-streams.json',
} as const;
const BRANCH_PREFIX = 'student-placement/';
const PULL_REQUEST_TITLE = 'Update student placement metadata';

function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createBranchName() {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, '-')
    .toLowerCase();
  return `student-placement/${timestamp}`;
}

async function deleteBranch(branch: string) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;

  try {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  } catch (error) {
    console.warn(`Failed to delete branch ${branch}:`, error);
  }
}

async function closeOpenPlacementPullRequests(updatedBy: string) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const pulls = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  });

  let closed = 0;
  for (const pull of pulls.data) {
    const isStudentPlacementPull =
      pull.head.ref.startsWith(BRANCH_PREFIX) ||
      pull.title === PULL_REQUEST_TITLE;
    if (!isStudentPlacementPull) continue;

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull.number,
      body: [
        'Closing this stale student placement metadata draft.',
        '',
        `A newer draft was submitted by \`${updatedBy}\`.`,
      ].join('\n'),
    });
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: pull.number,
      state: 'closed',
    });
    await deleteBranch(pull.head.ref);
    closed += 1;
  }
  return closed;
}

async function findStudentPlacementPullRequest(state: 'open' | 'closed') {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const pulls = await octokit.pulls.list({
    owner,
    repo,
    state,
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  });

  return (
    pulls.data.find(
      (pull) =>
        pull.head.ref.startsWith(BRANCH_PREFIX) ||
        pull.title === PULL_REQUEST_TITLE
    ) ?? null
  );
}

async function getDefaultBranchSha() {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const repository = await octokit.repos.get({ owner, repo });
  const branch = await octokit.repos.getBranch({
    owner,
    repo,
    branch: repository.data.default_branch,
  });

  return {
    defaultBranch: repository.data.default_branch,
    sha: branch.data.commit.sha,
  };
}

async function readFile(path: string, ref?: string): Promise<FileEntry | null> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
    });

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      return null;
    }

    return {
      content: decodeBase64(response.data.content),
      sha: response.data.sha,
    };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
}

async function writeFile(input: {
  path: string;
  branch: string;
  content: string;
  message: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const existing = await readFile(input.path, input.branch);

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.path,
    message: input.message,
    content: encodeBase64(input.content),
    branch: input.branch,
    sha: existing?.sha,
  });
}

export async function upsertStudentPlacementPr(
  input: UpdateStudentPlacementInput
): Promise<StudentPlacementPrStatus> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const { defaultBranch, sha } = await getDefaultBranchSha();
  const branch = createBranchName();
  let createdBranch = false;

  try {
    await closeOpenPlacementPullRequests(input.updatedBy);

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha,
    });
    createdBranch = true;

    await writeFile({
      path: FILES.placement,
      branch,
      content: stringifyJson(input.placement),
      message: 'Update student placement rules',
    });
    await writeFile({
      path: FILES.alumni,
      branch,
      content: stringifyJson(input.alumni),
      message: 'Update student alumni rules',
    });
    await writeFile({
      path: FILES.postgraduateProgrammes,
      branch,
      content: stringifyJson(input.postgraduateProgrammes),
      message: 'Update postgraduate programme rules',
    });
    await writeFile({
      path: FILES.studentStreams,
      branch,
      content: stringifyJson(input.studentStreams),
      message: 'Update honours stream rules',
    });

    const pullRequest = await octokit.pulls.create({
      owner,
      repo,
      title: PULL_REQUEST_TITLE,
      body: [
        'Updates trusted student placement metadata.',
        '',
        `Updated by: ${input.updatedBy}`,
        '',
        `- ${FILES.placement}`,
        `- ${FILES.alumni}`,
        `- ${FILES.postgraduateProgrammes}`,
        `- ${FILES.studentStreams}`,
      ].join('\n'),
      head: branch,
      base: defaultBranch,
    });

    return {
      status: 'open',
      number: pullRequest.data.number,
      url: pullRequest.data.html_url,
      branch,
      headSha: pullRequest.data.head.sha,
      canEdit: true,
      updatedAt: pullRequest.data.updated_at ?? undefined,
    };
  } catch (error) {
    if (createdBranch) await deleteBranch(branch);
    throw error;
  }
}

export async function getStudentPlacementPrStatus(): Promise<StudentPlacementPrStatus> {
  const openPull = await findStudentPlacementPullRequest('open');
  if (openPull) {
    return {
      status: 'open',
      number: openPull.number,
      url: openPull.html_url,
      branch: openPull.head.ref,
      headSha: openPull.head.sha,
      canEdit: true,
      updatedAt: openPull.updated_at ?? undefined,
    };
  }

  const latestPull = await findStudentPlacementPullRequest('closed');
  if (!latestPull) return { status: 'none', canEdit: false };

  return {
    status: latestPull.merged_at ? 'merged' : 'closed',
    number: latestPull.number,
    url: latestPull.html_url,
    branch: latestPull.head.ref,
    headSha: latestPull.head.sha,
    canEdit: false,
    updatedAt: latestPull.updated_at ?? undefined,
  };
}

export async function discardStudentPlacementPrs(
  updatedBy: string
): Promise<StudentPlacementPrCleanupResult> {
  return {
    closed: await closeOpenPlacementPullRequests(updatedBy),
  };
}
