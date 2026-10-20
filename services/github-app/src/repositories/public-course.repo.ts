import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import {
  normalizeAcademicId,
  removeAcademicRecord,
  upsertAcademicRecord,
} from '@/domains/academics/academic.projection';
import { isGitHubMissingRefError, isGitHubNotFoundError } from '@/utils/github';

type AcademicRegistryKind = 'course' | 'offering';

export interface PublicAcademicPrStatus {
  status: 'none' | 'open' | 'merged' | 'closed';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  revision?: string;
  canEdit: boolean;
  updatedAt?: string;
  targetRecordFile?: string;
  targetAggregateFile?: string;
  draftRecord?: Record<string, unknown> | null;
}

export interface PublicAcademicPrResult extends PublicAcademicPrStatus {
  status: 'open';
}

export interface PublicAcademicListResult {
  records: Record<string, unknown>[];
  targetAggregateFile: string;
}

export interface PublicAcademicRecordResult {
  record: Record<string, unknown>;
  revision?: string;
  targetRecordFile: string;
  targetAggregateFile: string;
}

interface UpdatePublicAcademicInput {
  kind: AcademicRegistryKind;
  id: string;
  updatedBy: string;
  recordPath: string;
  aggregatePath: string;
  record: Record<string, unknown>;
  expectedHeadSha?: string;
}

interface DeletePublicAcademicInput {
  kind: AcademicRegistryKind;
  id: string;
  updatedBy: string;
  recordPath: string;
  aggregatePath: string;
  expectedHeadSha?: string;
}

interface FileEntry {
  content: string;
  sha?: string;
}

const ACADEMIC_COURSES_AGGREGATE_PATH = 'public/academic/v2/courses.json';
const ACADEMIC_OFFERINGS_AGGREGATE_PATH = 'public/academic/v2/offerings.json';
const LABELS = {
  course: ['course-update', 'auto-merge-course'],
  offering: ['course-offering-update', 'auto-merge-course'],
} as const;
const DELETE_LABELS = {
  course: ['course-delete', 'auto-merge-course'],
  offering: ['course-offering-delete', 'auto-merge-course'],
} as const;

export class PublicAcademicConflictError extends Error {
  readonly status = 409;

  constructor() {
    super(
      'This academic registry draft changed after you loaded it. Refresh before submitting again.'
    );
    this.name = 'PublicAcademicConflictError';
  }
}

function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function normalizeId(id: string): string {
  return normalizeAcademicId(id);
}

function aggregatePathForKind(kind: AcademicRegistryKind): string {
  return kind === 'course'
    ? ACADEMIC_COURSES_AGGREGATE_PATH
    : ACADEMIC_OFFERINGS_AGGREGATE_PATH;
}

function recordPathForKind(kind: AcademicRegistryKind, id: string): string {
  const normalizedId = normalizeId(id);
  return kind === 'course'
    ? `public/academic/v2/courses/${normalizedId}.json`
    : `public/academic/v2/offerings/${normalizedId}.json`;
}

function createBranchName(kind: AcademicRegistryKind, id: string): string {
  return kind === 'course'
    ? `course/${normalizeId(id)}`
    : `course-offering/${normalizeId(id)}`;
}

function createDeleteBranchName(
  kind: AcademicRegistryKind,
  id: string
): string {
  return kind === 'course'
    ? `course-delete/${normalizeId(id)}`
    : `course-offering-delete/${normalizeId(id)}`;
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parsePullRequestBody(body: string): {
  kind?: 'update' | 'delete';
  targetRecordFile?: string;
  targetAggregateFile?: string;
} {
  const metadata: {
    kind?: 'update' | 'delete';
    targetRecordFile?: string;
    targetAggregateFile?: string;
  } = {};

  if (body.includes('<!-- academic-delete')) {
    metadata.kind = 'delete';
  } else if (body.includes('<!-- academic-update')) {
    metadata.kind = 'update';
  }

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();
    if (!value) continue;

    if (key === 'targetRecordFile') {
      metadata.targetRecordFile = value;
    } else if (key === 'targetAggregateFile') {
      metadata.targetAggregateFile = value;
    }
  }

  return metadata;
}

function pullRequestBody(input: {
  kind: AcademicRegistryKind;
  action: 'update' | 'delete';
  id: string;
  updatedBy: string;
  recordPath: string;
  aggregatePath: string;
}): string {
  return [
    `<!-- academic-${input.action}`,
    `kind: ${input.kind}`,
    `id: ${input.id}`,
    `targetRecordFile: ${input.recordPath}`,
    `targetAggregateFile: ${input.aggregatePath}`,
    '-->',
    '',
    `Automated public academic ${input.kind} ${input.action} requested by ${input.updatedBy}.`,
    '',
    'This PR is expected to be validated and auto-merged by GitHub Actions.',
  ].join('\n');
}

async function getDefaultBranchSha(): Promise<{
  defaultBranch: string;
  sha: string;
}> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const repository = await octokit.repos.get({ owner, repo });
  const defaultBranch = repository.data.default_branch;
  const baseRef = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  return { defaultBranch, sha: baseRef.data.object.sha };
}

async function resetBranchToSha(branch: string, sha: string): Promise<void> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha,
      force: true,
    });
  } catch (error) {
    if (!isGitHubNotFoundError(error) && !isGitHubMissingRefError(error)) {
      throw error;
    }

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha,
    });
  }
}

async function readFile(path: string, ref?: string): Promise<FileEntry | null> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
    });

    if (!Array.isArray(response.data) && 'content' in response.data) {
      return {
        content: decodeBase64(response.data.content),
        sha: response.data.sha,
      };
    }
  } catch (error) {
    if (!isGitHubNotFoundError(error)) {
      throw error;
    }
  }

  return null;
}

async function writeFile(input: {
  path: string;
  content: string;
  branch: string;
  message: string;
}): Promise<boolean> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const existing = await readFile(input.path, input.branch);

  if (existing?.content === input.content) return false;

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.path,
    message: input.message,
    content: encodeBase64(input.content),
    branch: input.branch,
    sha: existing?.sha,
  });

  return true;
}

async function deleteFile(input: {
  path: string;
  branch: string;
  message: string;
}): Promise<boolean> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const existing = await readFile(input.path, input.branch);

  if (!existing?.sha) return false;

  await octokit.repos.deleteFile({
    owner,
    repo,
    path: input.path,
    message: input.message,
    branch: input.branch,
    sha: existing.sha,
  });

  return true;
}

async function findPullRequest(
  kind: AcademicRegistryKind,
  id: string,
  state: 'open' | 'closed' | 'all'
) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalizedId = normalizeId(id);
  const pulls = await octokit.pulls.list({
    owner,
    repo,
    state,
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  });

  return (
    pulls.data.find((pull) => {
      const body = pull.body ?? '';
      return (
        pull.head.ref === createBranchName(kind, normalizedId) ||
        pull.head.ref === createDeleteBranchName(kind, normalizedId) ||
        (body.includes(`kind: ${kind}`) && body.includes(`id: ${normalizedId}`))
      );
    }) ?? null
  );
}

function assertExpectedPullHead(input: {
  existingPull: Awaited<ReturnType<typeof findPullRequest>>;
  expectedHeadSha?: string;
}) {
  if (!input.existingPull) return;

  if (input.existingPull.head.sha !== input.expectedHeadSha) {
    throw new PublicAcademicConflictError();
  }
}

async function addComment(input: {
  issueNumber: number;
  kind: AcademicRegistryKind;
  id: string;
  updatedBy: string;
  branch: string;
  action: 'update' | 'delete';
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: input.issueNumber,
    body: [
      `**Academic ${input.kind} ${input.action}**`,
      '',
      `Draft for \`${normalizeId(input.id)}\` was updated by \`${input.updatedBy}\`.`,
      `Branch: \`${input.branch}\``,
    ].join('\n'),
  });
}

export async function listPublicAcademicRecords(
  kind: AcademicRegistryKind
): Promise<PublicAcademicListResult> {
  const aggregatePath = aggregatePathForKind(kind);
  const aggregate = await readFile(aggregatePath);
  const value = aggregate ? parseJson(aggregate.content) : [];
  const records = Array.isArray(value)
    ? value.filter(
        (record): record is Record<string, unknown> =>
          record !== null &&
          typeof record === 'object' &&
          !Array.isArray(record)
      )
    : [];

  return {
    records,
    targetAggregateFile: aggregatePath,
  };
}

export async function getPublicAcademicRecord(
  kind: AcademicRegistryKind,
  id: string
): Promise<PublicAcademicRecordResult | null> {
  const normalizedId = normalizeId(id);
  const recordPath = recordPathForKind(kind, normalizedId);
  const entry = await readFile(recordPath);
  if (!entry) return null;
  const record = parseJson(entry.content) as Record<string, unknown>;

  return {
    record,
    revision: entry.sha,
    targetRecordFile: recordPath,
    targetAggregateFile: aggregatePathForKind(kind),
  };
}

export async function getPublicAcademicPrStatus(
  kind: AcademicRegistryKind,
  id: string
): Promise<PublicAcademicPrStatus> {
  const normalizedId = normalizeId(id);
  const openPull = await findPullRequest(kind, normalizedId, 'open');
  if (openPull) {
    const metadata = parsePullRequestBody(openPull.body ?? '');
    const targetRecordFile =
      metadata.targetRecordFile ?? recordPathForKind(kind, normalizedId);
    const draftEntry = await readFile(targetRecordFile, openPull.head.ref);
    const draftValue = draftEntry ? parseJson(draftEntry.content) : null;
    const draftRecord =
      draftValue && typeof draftValue === 'object' && !Array.isArray(draftValue)
        ? (draftValue as Record<string, unknown>)
        : null;

    return {
      status: 'open',
      number: openPull.number,
      url: openPull.html_url,
      branch: openPull.head.ref,
      headSha: openPull.head.sha,
      revision: draftEntry?.sha,
      canEdit: true,
      updatedAt: openPull.updated_at,
      targetRecordFile,
      targetAggregateFile:
        metadata.targetAggregateFile ?? aggregatePathForKind(kind),
      draftRecord,
    };
  }

  const latestPull = await findPullRequest(kind, normalizedId, 'closed');
  const publishedEntry = await readFile(recordPathForKind(kind, normalizedId));
  const revision = publishedEntry?.sha ?? 'missing';
  if (!latestPull) {
    return { status: 'none', canEdit: false, revision };
  }

  return {
    status: latestPull.merged_at ? 'merged' : 'closed',
    number: latestPull.number,
    url: latestPull.html_url,
    branch: latestPull.head.ref,
    revision,
    canEdit: false,
    updatedAt: latestPull.updated_at,
  };
}

export async function upsertPublicAcademicPr(
  input: UpdatePublicAcademicInput
): Promise<PublicAcademicPrResult> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalizedId = normalizeId(input.id);
  const existingPull = await findPullRequest(input.kind, normalizedId, 'open');
  assertExpectedPullHead({
    existingPull,
    expectedHeadSha: input.expectedHeadSha,
  });
  const { defaultBranch, sha } = await getDefaultBranchSha();
  const branch =
    existingPull?.head.ref ?? createBranchName(input.kind, normalizedId);

  await resetBranchToSha(branch, sha);

  await writeFile({
    path: input.recordPath,
    branch,
    content: stringifyJson(input.record),
    message: `Update public ${input.kind} for ${normalizedId}`,
  });

  const existingAggregate = await readFile(input.aggregatePath, branch);
  const aggregateJson = existingAggregate
    ? parseJson(existingAggregate.content)
    : [];
  await writeFile({
    path: input.aggregatePath,
    branch,
    content: stringifyJson(upsertAcademicRecord(aggregateJson, input.record)),
    message: `Update public ${input.kind} listing for ${normalizedId}`,
  });

  if (existingPull) {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPull.number,
      body: pullRequestBody({ ...input, action: 'update' }),
    });
    await addComment({
      issueNumber: existingPull.number,
      kind: input.kind,
      id: normalizedId,
      updatedBy: input.updatedBy,
      branch,
      action: 'update',
    });

    const status = await getPublicAcademicPrStatus(input.kind, normalizedId);
    return { ...status, status: 'open' };
  }

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: `Update public ${input.kind} for ${normalizedId}`,
    body: pullRequestBody({ ...input, action: 'update' }),
    head: branch,
    base: defaultBranch,
  });

  for (const label of LABELS[input.kind]) {
    try {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pullRequest.data.number,
        labels: [label],
      });
    } catch (error) {
      console.warn(`Failed to add label ${label}:`, error);
    }
  }

  const status = await getPublicAcademicPrStatus(input.kind, normalizedId);
  return { ...status, status: 'open' };
}

export async function deletePublicAcademicPr(
  input: DeletePublicAcademicInput
): Promise<PublicAcademicPrStatus> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalizedId = normalizeId(input.id);
  const existingPull = await findPullRequest(input.kind, normalizedId, 'open');
  assertExpectedPullHead({
    existingPull,
    expectedHeadSha: input.expectedHeadSha,
  });
  const { defaultBranch, sha } = await getDefaultBranchSha();
  const branch =
    existingPull?.head.ref ?? createDeleteBranchName(input.kind, normalizedId);

  await resetBranchToSha(branch, sha);

  const deletedRecordFile = await deleteFile({
    path: input.recordPath,
    branch,
    message: `Delete public ${input.kind} for ${normalizedId}`,
  });

  const existingAggregate = await readFile(input.aggregatePath, branch);
  const aggregateJson = existingAggregate
    ? parseJson(existingAggregate.content)
    : [];
  const updatedAggregate = await writeFile({
    path: input.aggregatePath,
    branch,
    content: stringifyJson(removeAcademicRecord(aggregateJson, normalizedId)),
    message: `Update public ${input.kind} listing for ${normalizedId}`,
  });

  if (!existingPull && !deletedRecordFile && !updatedAggregate) {
    return { status: 'none', canEdit: false };
  }

  if (existingPull) {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPull.number,
      body: pullRequestBody({ ...input, action: 'delete' }),
    });
    await addComment({
      issueNumber: existingPull.number,
      kind: input.kind,
      id: normalizedId,
      updatedBy: input.updatedBy,
      branch,
      action: 'delete',
    });

    const status = await getPublicAcademicPrStatus(input.kind, normalizedId);
    return { ...status, status: 'open' };
  }

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: `Delete public ${input.kind} for ${normalizedId}`,
    body: pullRequestBody({ ...input, action: 'delete' }),
    head: branch,
    base: defaultBranch,
  });

  for (const label of DELETE_LABELS[input.kind]) {
    try {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pullRequest.data.number,
        labels: [label],
      });
    } catch (error) {
      console.warn(`Failed to add label ${label}:`, error);
    }
  }

  const status = await getPublicAcademicPrStatus(input.kind, normalizedId);
  return { ...status, status: 'open' };
}

export const publicAcademicPaths = {
  courseAggregate: ACADEMIC_COURSES_AGGREGATE_PATH,
  offeringAggregate: ACADEMIC_OFFERINGS_AGGREGATE_PATH,
  courseRecord: (id: string) => recordPathForKind('course', id),
  offeringRecord: (id: string) => recordPathForKind('offering', id),
};
