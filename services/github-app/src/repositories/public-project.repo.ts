import type { EntityRevision, Project } from '@scs/schemas';

import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import { isGitHubMissingRefError, isGitHubNotFoundError } from '@/utils/github';

export interface PublicProjectPrStatus {
  status: 'none' | 'open' | 'merged' | 'closed';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: EntityRevision;
  canEdit: boolean;
  updatedAt?: string;
  targetProjectFile?: string;
  targetAggregateFile?: string;
  targetManifestFile?: string;
  draftProject?: Record<string, unknown> | null;
}

export interface PublicProjectPrResult extends PublicProjectPrStatus {
  status: 'open';
}

export interface PublicProjectsResult {
  projects: Record<string, unknown>[];
  targetAggregateFile: string;
  targetManifestFile: string;
}

export interface PublicProjectResult {
  project: Record<string, unknown>;
  targetProjectFile: string;
  targetAggregateFile: string;
  targetManifestFile: string;
}

interface UpdatePublicProjectInput {
  slug: string;
  updatedBy: string;
  updatedByType?: 'owner' | 'admin';
  projectPath: string;
  aggregatePath: 'public/projects/v2/projects.json';
  manifestPath: 'public/projects/v2/manifest.json';
  project: Project;
  expectedHeadSha?: EntityRevision;
}

interface DeletePublicProjectInput {
  slug: string;
  updatedBy: string;
  updatedByType?: 'admin';
  projectPath: string;
  aggregatePath: 'public/projects/v2/projects.json';
  manifestPath: 'public/projects/v2/manifest.json';
  expectedHeadSha?: EntityRevision;
}

interface FileEntry {
  content: string;
  sha?: string;
}

interface ProjectManifest {
  version: string;
  updatedAt?: string;
  projects: ProjectManifestEntry[];
}

interface ProjectManifestEntry {
  id: string;
  slug: string;
  title: string;
  href: string;
}

interface ProjectByPersonEntry {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  projectType: Project['projectType'];
  status: Project['status'];
  categories: string[];
  tags: string[];
  academicYear?: Project['academicYear'];
  role: Project['people'][number]['role'];
  href: string;
  lastUpdatedAt: string;
}

const PROJECT_LABELS = ['project-update', 'auto-merge-project'];
const PROJECT_DELETE_LABELS = ['project-delete', 'auto-merge-project'];
const PROJECTS_AGGREGATE_PATH = 'public/projects/v2/projects.json';
const PROJECTS_MANIFEST_PATH = 'public/projects/v2/manifest.json';

export class PublicProjectConflictError extends Error {
  readonly status = 409;

  constructor() {
    super(
      'This project draft changed after you loaded it. Refresh the project before submitting again.'
    );
    this.name = 'PublicProjectConflictError';
  }
}

function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function projectPathForSlug(slug: string): string {
  return `public/projects/v2/projects/${normalizeSlug(slug)}.json`;
}

function byPersonPathForUsername(username: string): string {
  return `public/projects/v2/by-person/${normalizeSlug(username)}.json`;
}

function createBranchName(slug: string): string {
  return `project/${normalizeSlug(slug)}`;
}

function createDeleteBranchName(slug: string): string {
  return `project-delete/${normalizeSlug(slug)}`;
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parseProjectPullRequestBody(body: string): {
  kind?: 'update' | 'delete';
  targetProjectFile?: string;
  targetAggregateFile?: string;
  targetManifestFile?: string;
} {
  const metadata: {
    kind?: 'update' | 'delete';
    targetProjectFile?: string;
    targetAggregateFile?: string;
    targetManifestFile?: string;
  } = {};

  if (body.includes('<!-- project-delete')) {
    metadata.kind = 'delete';
  } else if (body.includes('<!-- project-update')) {
    metadata.kind = 'update';
  }

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();
    if (!value) continue;

    if (key === 'targetProjectFile') {
      metadata.targetProjectFile = value;
    } else if (key === 'targetAggregateFile') {
      metadata.targetAggregateFile = value;
    } else if (key === 'targetManifestFile') {
      metadata.targetManifestFile = value;
    }
  }

  return metadata;
}

function projectPullRequestBody(input: {
  slug: string;
  updatedBy: string;
  projectPath: string;
  aggregatePath: string;
  manifestPath: string;
}): string {
  return [
    '<!-- project-update',
    `slug: ${input.slug}`,
    `targetProjectFile: ${input.projectPath}`,
    `targetAggregateFile: ${input.aggregatePath}`,
    `targetManifestFile: ${input.manifestPath}`,
    '-->',
    '',
    `Automated public project update requested by ${input.updatedBy}.`,
    '',
    'This PR is expected to be validated and auto-merged by GitHub Actions.',
  ].join('\n');
}

function projectDeletePullRequestBody(input: {
  slug: string;
  updatedBy: string;
  projectPath: string;
  aggregatePath: string;
  manifestPath: string;
}): string {
  return [
    '<!-- project-delete',
    `slug: ${input.slug}`,
    `targetProjectFile: ${input.projectPath}`,
    `targetAggregateFile: ${input.aggregatePath}`,
    `targetManifestFile: ${input.manifestPath}`,
    '-->',
    '',
    `Automated public project deletion requested by ${input.updatedBy}.`,
    '',
    'This PR removes the project detail file and reconciles the public indexes.',
  ].join('\n');
}

function upsertProject(existingValue: unknown, project: Project): Project[] {
  const records = Array.isArray(existingValue) ? existingValue : [];
  const nextRecords = records.filter(
    (record): record is Project =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug !== project.slug
  );

  nextRecords.push(project);
  return nextRecords.sort((left, right) =>
    left.title.localeCompare(right.title)
  );
}

function removeProject(existingValue: unknown, slug: string): Project[] {
  const records = Array.isArray(existingValue) ? existingValue : [];
  return records
    .filter(
      (record): record is Project =>
        record !== null &&
        typeof record === 'object' &&
        !Array.isArray(record) &&
        (record as { slug?: unknown }).slug !== slug
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function hasProjectInAggregate(
  existingValue: unknown,
  slug: string
): boolean {
  const normalizedSlug = normalizeSlug(slug);
  const records = Array.isArray(existingValue) ? existingValue : [];

  return records.some(
    (record) =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug === normalizedSlug
  );
}

export function removeProjectFromAggregate(
  existingValue: unknown,
  slug: string
): Project[] {
  return removeProject(existingValue, normalizeSlug(slug));
}

function manifestEntryForProject(project: Project): ProjectManifestEntry {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    href: `projects/${project.slug}.json`,
  };
}

function usernamesForProject(project: Project | undefined): Set<string> {
  const usernames = new Set<string>();
  if (!project) return usernames;

  for (const person of project.people) {
    if (person.username) {
      usernames.add(normalizeSlug(person.username));
    }
  }

  return usernames;
}

function byPersonEntryForProject(
  project: Project,
  role: ProjectByPersonEntry['role']
): ProjectByPersonEntry {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    shortDescription: project.shortDescription,
    projectType: project.projectType,
    status: project.status,
    categories: project.categories,
    tags: project.tags,
    ...(project.academicYear ? { academicYear: project.academicYear } : {}),
    role,
    href: `projects/${project.slug}.json`,
    lastUpdatedAt: project.dates.lastUpdatedAt,
  };
}

function buildByPersonIndex(
  aggregateValue: unknown,
  username: string
): ProjectByPersonEntry[] {
  const normalizedUsername = normalizeSlug(username);
  const records = Array.isArray(aggregateValue) ? aggregateValue : [];
  const entries: ProjectByPersonEntry[] = [];

  for (const record of records) {
    const parsed =
      record !== null && typeof record === 'object'
        ? (record as Project)
        : null;
    if (!parsed) continue;

    const member = parsed.people.find(
      (person) =>
        person.username && normalizeSlug(person.username) === normalizedUsername
    );
    if (!member) continue;

    entries.push(byPersonEntryForProject(parsed, member.role));
  }

  return entries.sort(
    (left, right) =>
      left.title.localeCompare(right.title) ||
      left.slug.localeCompare(right.slug)
  );
}

function projectFromAggregate(
  aggregateValue: unknown,
  slug: string
): Project | undefined {
  const normalizedSlug = normalizeSlug(slug);
  const records = Array.isArray(aggregateValue) ? aggregateValue : [];

  return records.find(
    (record): record is Project =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug === normalizedSlug
  );
}

function manifestUpdatedAt(
  existing: Partial<ProjectManifest>,
  updatedAt?: string
): string | undefined {
  if (updatedAt) {
    return updatedAt;
  }

  return typeof existing.updatedAt === 'string'
    ? existing.updatedAt
    : undefined;
}

export function upsertProjectManifest(
  existingValue: unknown,
  project: Project,
  updatedAt?: string
): ProjectManifest {
  const existing =
    existingValue !== null &&
    typeof existingValue === 'object' &&
    !Array.isArray(existingValue)
      ? (existingValue as Partial<ProjectManifest>)
      : {};
  const records = Array.isArray(existing.projects) ? existing.projects : [];
  const nextProjects = records.filter(
    (record): record is ProjectManifestEntry =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug !== project.slug
  );

  nextProjects.push(manifestEntryForProject(project));

  return {
    version: typeof existing.version === 'string' ? existing.version : '1',
    updatedAt: manifestUpdatedAt(existing, updatedAt),
    projects: nextProjects.sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
  };
}

export function hasProjectInManifest(
  existingValue: unknown,
  slug: string
): boolean {
  const normalizedSlug = normalizeSlug(slug);
  const existing =
    existingValue !== null &&
    typeof existingValue === 'object' &&
    !Array.isArray(existingValue)
      ? (existingValue as Partial<ProjectManifest>)
      : {};
  const records = Array.isArray(existing.projects) ? existing.projects : [];

  return records.some(
    (record) =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug === normalizedSlug
  );
}

export function removeProjectManifest(
  existingValue: unknown,
  slug: string,
  updatedAt?: string
): ProjectManifest {
  const existing =
    existingValue !== null &&
    typeof existingValue === 'object' &&
    !Array.isArray(existingValue)
      ? (existingValue as Partial<ProjectManifest>)
      : {};
  const records = Array.isArray(existing.projects) ? existing.projects : [];
  const nextProjects = records.filter(
    (record): record is ProjectManifestEntry =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug !== slug
  );

  return {
    version: typeof existing.version === 'string' ? existing.version : '1',
    updatedAt: manifestUpdatedAt(existing, updatedAt),
    projects: nextProjects.sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
  };
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

async function reconcileByPersonIndexes(input: {
  branch: string;
  aggregateValue: unknown;
  usernames: Set<string>;
}) {
  for (const username of [...input.usernames].sort()) {
    const entries = buildByPersonIndex(input.aggregateValue, username);
    const path = byPersonPathForUsername(username);

    if (entries.length === 0) {
      await deleteFile({
        path,
        branch: input.branch,
        message: `Update public project people index for ${username}`,
      });
      continue;
    }

    await writeFile({
      path,
      branch: input.branch,
      content: stringifyJson(entries),
      message: `Update public project people index for ${username}`,
    });
  }
}

async function addProjectPrUpdateComment(input: {
  issueNumber: number;
  slug: string;
  updatedBy: string;
  updatedByType?: 'owner' | 'admin';
  branch: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const actorLabel =
    input.updatedByType === 'admin'
      ? 'Admin edit'
      : input.updatedByType === 'owner'
        ? 'Owner edit'
        : 'Project edit';

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: input.issueNumber,
    body: [
      `**${actorLabel}**`,
      '',
      `Project draft for \`${normalizeSlug(input.slug)}\` was updated by \`${input.updatedBy}\`.`,
      `Branch: \`${input.branch}\``,
    ].join('\n'),
  });
}

async function addProjectPrDeleteComment(input: {
  issueNumber: number;
  slug: string;
  updatedBy: string;
  branch: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: input.issueNumber,
    body: [
      '**Admin delete**',
      '',
      `Project deletion for \`${normalizeSlug(input.slug)}\` was requested by \`${input.updatedBy}\`.`,
      `Branch: \`${input.branch}\``,
    ].join('\n'),
  });
}

async function updateProjectPullRequestBody(input: {
  issueNumber: number;
  slug: string;
  updatedBy: string;
  projectPath: string;
  aggregatePath: string;
  manifestPath: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  await octokit.pulls.update({
    owner,
    repo,
    pull_number: input.issueNumber,
    body: projectPullRequestBody(input),
  });
}

async function updateProjectDeletePullRequestBody(input: {
  issueNumber: number;
  slug: string;
  updatedBy: string;
  projectPath: string;
  aggregatePath: string;
  manifestPath: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;

  await octokit.pulls.update({
    owner,
    repo,
    pull_number: input.issueNumber,
    body: projectDeletePullRequestBody(input),
  });
}

async function findProjectPullRequest(
  slug: string,
  state: 'open' | 'closed' | 'all'
) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalized = normalizeSlug(slug);
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
        pull.head.ref === `project/${normalized}` ||
        pull.head.ref === `project-delete/${normalized}` ||
        body.includes(`slug: ${normalized}`)
      );
    }) ?? null
  );
}

function assertExpectedPullHead(input: {
  existingPull: Awaited<ReturnType<typeof findProjectPullRequest>>;
  expectedHeadSha?: string;
}) {
  if (!input.existingPull) return;

  if (input.existingPull.head.sha !== input.expectedHeadSha) {
    throw new PublicProjectConflictError();
  }
}

export async function listPublicProjects(): Promise<PublicProjectsResult> {
  const aggregate = await readFile(PROJECTS_AGGREGATE_PATH);
  const value = aggregate ? parseJson(aggregate.content) : [];
  const projects = Array.isArray(value)
    ? value.filter(
        (record): record is Record<string, unknown> =>
          record !== null &&
          typeof record === 'object' &&
          !Array.isArray(record)
      )
    : [];

  return {
    projects,
    targetAggregateFile: PROJECTS_AGGREGATE_PATH,
    targetManifestFile: PROJECTS_MANIFEST_PATH,
  };
}

export async function getPublicProject(
  slug: string
): Promise<PublicProjectResult | null> {
  const normalizedSlug = normalizeSlug(slug);
  const path = projectPathForSlug(normalizedSlug);
  const entry = await readFile(path);
  if (!entry) return null;
  const project = parseJson(entry.content) as Record<string, unknown>;

  return {
    project,
    targetProjectFile: path,
    targetAggregateFile: PROJECTS_AGGREGATE_PATH,
    targetManifestFile: PROJECTS_MANIFEST_PATH,
  };
}

export async function getPublicProjectPrStatus(
  slug: string
): Promise<PublicProjectPrStatus> {
  const normalizedSlug = normalizeSlug(slug);
  const openPull = await findProjectPullRequest(normalizedSlug, 'open');
  if (openPull) {
    const metadata = parseProjectPullRequestBody(openPull.body ?? '');
    const targetProjectFile =
      metadata.targetProjectFile ?? projectPathForSlug(normalizedSlug);
    const draftEntry = await readFile(targetProjectFile, openPull.head.ref);
    const draftValue = draftEntry ? parseJson(draftEntry.content) : null;
    const draftProject =
      draftValue && typeof draftValue === 'object' && !Array.isArray(draftValue)
        ? (draftValue as Record<string, unknown>)
        : null;

    return {
      status: 'open',
      number: openPull.number,
      url: openPull.html_url,
      branch: openPull.head.ref,
      headSha: openPull.head.sha,
      canEdit: true,
      updatedAt: openPull.updated_at,
      targetProjectFile,
      targetAggregateFile:
        metadata.targetAggregateFile ?? PROJECTS_AGGREGATE_PATH,
      targetManifestFile: metadata.targetManifestFile ?? PROJECTS_MANIFEST_PATH,
      draftProject,
    };
  }

  const latestPull = await findProjectPullRequest(normalizedSlug, 'closed');
  if (!latestPull) {
    return { status: 'none', canEdit: false };
  }

  return {
    status: latestPull.merged_at ? 'merged' : 'closed',
    number: latestPull.number,
    url: latestPull.html_url,
    branch: latestPull.head.ref,
    canEdit: false,
    updatedAt: latestPull.updated_at,
  };
}

export async function upsertPublicProjectPr(
  input: UpdatePublicProjectInput
): Promise<PublicProjectPrResult> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalizedSlug = normalizeSlug(input.slug);
  const existingPull = await findProjectPullRequest(normalizedSlug, 'open');
  assertExpectedPullHead({
    existingPull,
    expectedHeadSha: input.expectedHeadSha,
  });
  const { defaultBranch, sha } = await getDefaultBranchSha();
  const branch = existingPull?.head.ref ?? createBranchName(normalizedSlug);

  await resetBranchToSha(branch, sha);

  await writeFile({
    path: input.projectPath,
    branch,
    content: stringifyJson(input.project),
    message: `Update public project for ${normalizedSlug}`,
  });

  const existingAggregate = await readFile(input.aggregatePath, branch);
  const aggregateJson = existingAggregate
    ? parseJson(existingAggregate.content)
    : [];
  const previousProject = projectFromAggregate(aggregateJson, normalizedSlug);
  const nextAggregate = upsertProject(aggregateJson, input.project);
  await writeFile({
    path: input.aggregatePath,
    branch,
    content: stringifyJson(nextAggregate),
    message: `Update public projects listing for ${normalizedSlug}`,
  });

  await reconcileByPersonIndexes({
    branch,
    aggregateValue: nextAggregate,
    usernames: new Set([
      ...usernamesForProject(previousProject),
      ...usernamesForProject(input.project),
    ]),
  });

  const existingManifest = await readFile(input.manifestPath, branch);
  const manifestJson = existingManifest
    ? parseJson(existingManifest.content)
    : {};
  await writeFile({
    path: input.manifestPath,
    branch,
    content: stringifyJson(upsertProjectManifest(manifestJson, input.project)),
    message: `Update public projects manifest for ${normalizedSlug}`,
  });

  if (existingPull) {
    await updateProjectPullRequestBody({
      issueNumber: existingPull.number,
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      projectPath: input.projectPath,
      aggregatePath: input.aggregatePath,
      manifestPath: input.manifestPath,
    });

    await addProjectPrUpdateComment({
      issueNumber: existingPull.number,
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      updatedByType: input.updatedByType,
      branch,
    });

    const status = await getPublicProjectPrStatus(normalizedSlug);
    return {
      ...status,
      status: 'open',
    };
  }

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: `Update public project for ${normalizedSlug}`,
    body: projectPullRequestBody({
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      projectPath: input.projectPath,
      aggregatePath: input.aggregatePath,
      manifestPath: input.manifestPath,
    }),
    head: branch,
    base: defaultBranch,
  });

  for (const label of PROJECT_LABELS) {
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

  const status = await getPublicProjectPrStatus(normalizedSlug);
  return {
    ...status,
    status: 'open',
  };
}

export async function deletePublicProjectPr(
  input: DeletePublicProjectInput
): Promise<PublicProjectPrStatus> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PROJECTS_DATA_REPOSITORY;
  const normalizedSlug = normalizeSlug(input.slug);
  const existingPull = await findProjectPullRequest(normalizedSlug, 'open');
  assertExpectedPullHead({
    existingPull,
    expectedHeadSha: input.expectedHeadSha,
  });
  const { defaultBranch, sha } = await getDefaultBranchSha();
  const branch =
    existingPull?.head.ref ?? createDeleteBranchName(normalizedSlug);

  if (!existingPull) {
    const existingProject = await readFile(input.projectPath);
    const existingAggregate = await readFile(input.aggregatePath);
    const aggregateJson = existingAggregate
      ? parseJson(existingAggregate.content)
      : [];
    const existingManifest = await readFile(input.manifestPath);
    const manifestJson = existingManifest
      ? parseJson(existingManifest.content)
      : {};

    if (
      !existingProject &&
      !hasProjectInAggregate(aggregateJson, normalizedSlug) &&
      !hasProjectInManifest(manifestJson, normalizedSlug)
    ) {
      return { status: 'none', canEdit: false };
    }
  }

  await resetBranchToSha(branch, sha);

  const deletedProjectFile = await deleteFile({
    path: input.projectPath,
    branch,
    message: `Delete public project for ${normalizedSlug}`,
  });

  const existingAggregate = await readFile(input.aggregatePath, branch);
  const aggregateJson = existingAggregate
    ? parseJson(existingAggregate.content)
    : [];
  const removedProject = projectFromAggregate(aggregateJson, normalizedSlug);
  const nextAggregate = removeProject(aggregateJson, normalizedSlug);
  const updatedAggregate = await writeFile({
    path: input.aggregatePath,
    branch,
    content: stringifyJson(nextAggregate),
    message: `Update public projects listing for ${normalizedSlug}`,
  });

  await reconcileByPersonIndexes({
    branch,
    aggregateValue: nextAggregate,
    usernames: usernamesForProject(removedProject),
  });

  const existingManifest = await readFile(input.manifestPath, branch);
  const manifestJson = existingManifest
    ? parseJson(existingManifest.content)
    : {};
  const updatedManifest = await writeFile({
    path: input.manifestPath,
    branch,
    content: stringifyJson(removeProjectManifest(manifestJson, normalizedSlug)),
    message: `Update public projects manifest for ${normalizedSlug}`,
  });

  if (
    !existingPull &&
    !deletedProjectFile &&
    !updatedAggregate &&
    !updatedManifest
  ) {
    return { status: 'none', canEdit: false };
  }

  if (existingPull) {
    await updateProjectDeletePullRequestBody({
      issueNumber: existingPull.number,
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      projectPath: input.projectPath,
      aggregatePath: input.aggregatePath,
      manifestPath: input.manifestPath,
    });

    await addProjectPrDeleteComment({
      issueNumber: existingPull.number,
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      branch,
    });

    const status = await getPublicProjectPrStatus(normalizedSlug);
    return {
      ...status,
      status: 'open',
    };
  }

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: `Delete public project for ${normalizedSlug}`,
    body: projectDeletePullRequestBody({
      slug: normalizedSlug,
      updatedBy: input.updatedBy,
      projectPath: input.projectPath,
      aggregatePath: input.aggregatePath,
      manifestPath: input.manifestPath,
    }),
    head: branch,
    base: defaultBranch,
  });

  for (const label of PROJECT_DELETE_LABELS) {
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

  const status = await getPublicProjectPrStatus(normalizedSlug);
  return {
    ...status,
    status: 'open',
  };
}
