import { Buffer } from 'node:buffer';

import {
  AcademicDepartmentCodeSchema,
  HonoursProgrammeStudentStreamMap,
  StudentStreamSchema,
  type PublicProfileKind,
  type PublicProfilePr,
} from '@scs/schemas';

import { getOctokit } from '@/config/client.config';
import envConfig from '@/config/env.config';
import {
  inferProfileKind,
  projectProfileMembership,
  removeProfileMembership as removeProfile,
  searchEntryForProfile,
} from '@/domains/profiles/profile.projection';
import type { PublicProfile } from '@/domains/profiles/profile.types';
import { isGitHubNotFoundError } from '@/utils/github';
import { JsonRecordSchema } from '@/utils/json-record';

export { removeProfileMembership as removeProfile } from '@/domains/profiles/profile.projection';

export class PublicProfileRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// The stored PR metadata carries a stream hint that the shared transport
// contract intentionally omits, so keep the local extension additive.
export type PublicProfilePrStatus = PublicProfilePr & { stream?: string };

export interface PublicProfilePrResult extends PublicProfilePrStatus {
  status: 'open';
}

export interface PublicProfileResult {
  profile: Record<string, unknown>;
  profileKind?: PublicProfileKind;
  stream?: string;
  targetUserFile: string;
  targetAggregateFiles: string[];
}

interface UpdatePublicProfileInput {
  username: string;
  updatedBy: string;
  updatedByType?: 'self' | 'admin';
  profileKind: PublicProfileKind;
  userPath: string;
  aggregatePaths: string[];
  profile: PublicProfile;
  expectedUserFileSha?: string | null;
  expectedPrHeadSha?: string;
}

interface DiscardPublicProfilePrInput {
  username: string;
  updatedBy: string;
  prNumber: number;
  expectedHeadSha: string;
  reason: string;
}

interface FileEntry {
  content: string;
  sha?: string;
}

const PROFILE_LABELS = ['profile-update', 'auto-merge-profile'];
const STAFF_AGGREGATE_PATHS = [
  'public/people/v2/staff/academic.json',
  'public/people/v2/staff/academic-support.json',
  'public/people/v2/staff/non-academic.json',
] as const;
const SPECIAL_STREAMS = StudentStreamSchema.options;
const STAFF_DEPARTMENTS = AcademicDepartmentCodeSchema.options.map((code) =>
  code.toLowerCase().replaceAll('_', '-')
);
const STAFF_KINDS = ['academic', 'academic-support', 'non-academic'] as const;
const SEARCH_INDEX_PATH = 'public/people/v2/search.json';

function encodeBase64(value: string): string {
  return Buffer.from(value).toString('base64');
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function createBranchName(username: string): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, '-')
    .toLowerCase();
  return `profile/${normalizeUsername(username)}-${timestamp}`;
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parseProfilePullRequestBody(body: string): {
  profileKind?: PublicProfileKind;
  stream?: string;
  targetUserFile?: string;
  targetAggregateFiles: string[];
} {
  const lines = body.split(/\r?\n/);
  const aggregateFiles: string[] = [];
  let inAggregateFiles = false;
  const metadata: {
    profileKind?: PublicProfileKind;
    stream?: string;
    targetUserFile?: string;
    targetAggregateFiles: string[];
  } = { targetAggregateFiles: aggregateFiles };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'targetAggregateFiles:') {
      inAggregateFiles = true;
      continue;
    }

    if (inAggregateFiles) {
      const match = /^-\s+(.+)$/.exec(trimmed);
      if (match) {
        aggregateFiles.push(match[1]);
        continue;
      }
      inAggregateFiles = false;
    }

    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();
    if (!value) continue;

    if (key === 'profileKind' && isPublicProfileKind(value)) {
      metadata.profileKind = value;
    } else if (key === 'stream') {
      metadata.stream = value;
    } else if (key === 'targetUserFile') {
      metadata.targetUserFile = value;
    }
  }

  return metadata;
}

function isPublicProfileKind(value: string): value is PublicProfileKind {
  return ['academic', 'academic-support', 'non-academic', 'student'].includes(
    value
  );
}

function inferSpecialStream(aggregatePaths: string[]): string | undefined {
  for (const path of aggregatePaths) {
    const match = /^public\/people\/v2\/special\/([^/]+)\//.exec(path);
    if (match) return match[1];
  }

  return undefined;
}

function studentBatchFromIdentity(identity: string): string | null {
  const match = /^s(\d{2})(sp)?\d{3}$/i.exec(identity.trim());
  return match ? `s${match[1]}` : null;
}

function staffAggregatePathForProfile(
  profile: Record<string, unknown>
): string | null {
  if (profile.staffType === 'ACADEMIC_TEACHING') {
    return 'public/people/v2/staff/academic.json';
  }

  if (profile.staffType === 'ACADEMIC_SUPPORT') {
    return 'public/people/v2/staff/academic-support.json';
  }

  if (profile.staffType === 'NON_ACADEMIC') {
    return 'public/people/v2/staff/non-academic.json';
  }

  return null;
}

function departmentStaffAggregatePathForProfile(
  profile: Record<string, unknown>
): string | null {
  const staffPath = staffAggregatePathForProfile(profile);
  const department =
    typeof profile.department === 'string'
      ? profile.department.trim().toLowerCase().replaceAll('_', '-')
      : '';
  const kind = staffPath?.split('/').at(-1);
  if (!department || !kind) return null;
  return `public/people/v2/staff/${department}/${kind}`;
}

export function candidateAggregatePathsForIdentity(
  identity: string,
  profileKind?: PublicProfileKind
): string[] {
  const normalizedIdentity = normalizeUsername(identity);
  const paths = new Set<string>();

  if (!profileKind || profileKind !== 'student') {
    for (const path of STAFF_AGGREGATE_PATHS) {
      paths.add(path);
    }
    for (const department of STAFF_DEPARTMENTS) {
      for (const kind of STAFF_KINDS) {
        paths.add(`public/people/v2/staff/${department}/${kind}.json`);
      }
    }
  }

  const batch = studentBatchFromIdentity(normalizedIdentity);

  if (batch && (!profileKind || profileKind === 'student')) {
    paths.add(`public/people/v2/students/${batch}.json`);
    for (const stream of SPECIAL_STREAMS) {
      paths.add(`public/people/v2/special/${stream}/${batch}.json`);
    }
  }

  return [...paths];
}

function hasSameRecords(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function profilePullRequestBody(input: {
  username: string;
  updatedBy: string;
  profileKind: PublicProfileKind;
  userPath: string;
  aggregatePaths: string[];
}): string {
  const stream = inferSpecialStream(input.aggregatePaths);

  return [
    '<!-- profile-update',
    `username: ${input.username}`,
    `profileKind: ${input.profileKind}`,
    ...(stream ? [`stream: ${stream}`] : []),
    `targetUserFile: ${input.userPath}`,
    'targetAggregateFiles:',
    ...input.aggregatePaths.map((path) => `- ${path}`),
    '-->',
    '',
    `Automated public profile update requested by ${input.updatedBy}.`,
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
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const repository = await octokit.repos.get({ owner, repo });
  const defaultBranch = repository.data.default_branch;
  const baseRef = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  return { defaultBranch, sha: baseRef.data.object.sha };
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

async function listDirectoryFiles(
  path: string,
  ref?: string
): Promise<string[]> {
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

    if (Array.isArray(response.data)) {
      return response.data
        .filter((entry) => entry.type === 'file')
        .map((entry) => `${path}/${entry.name}`)
        .sort();
    }
  } catch (error) {
    if (!isGitHubNotFoundError(error)) {
      throw error;
    }
  }

  return [];
}

async function writeFile(input: {
  path: string;
  content: string;
  branch: string;
  message: string;
}): Promise<void> {
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

async function getBranchHeadSha(branch: string): Promise<string | undefined> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;

  const ref = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  return ref.data.object.sha;
}

async function reconcileAggregateFiles(input: {
  branch: string;
  username: string;
  profileKind: PublicProfileKind;
  aggregatePaths: string[];
  profile: PublicProfile;
}): Promise<void> {
  /*
   * Synchronous compatibility callers still maintain projections here. New
   * entity-versioned operations commit only the authoritative user record;
   * remove this path after the external generator owns every projection.
   */
  const normalizedUsername = normalizeUsername(input.username);
  const targetPaths = new Set(input.aggregatePaths);
  const candidatePaths = candidateAggregatePathsForIdentity(
    normalizedUsername,
    input.profileKind
  );

  const staleCandidates = await Promise.all(
    candidatePaths
      .filter((path) => !targetPaths.has(path))
      .map(async (path) => {
        const existing = await readFile(path, input.branch);
        if (!existing) return null;

        const existingJson = parseJson(existing.content);
        const existingRecords = Array.isArray(existingJson)
          ? existingJson.filter(
              (record): record is Record<string, unknown> =>
                record !== null &&
                typeof record === 'object' &&
                !Array.isArray(record)
            )
          : [];
        const nextRecords = removeProfile(existingJson, normalizedUsername);
        if (hasSameRecords(existingRecords, nextRecords)) return null;

        return { path, nextRecords };
      })
  );

  for (const candidate of staleCandidates) {
    if (!candidate) continue;

    await writeFile({
      path: candidate.path,
      branch: input.branch,
      content: stringifyJson(candidate.nextRecords),
      message: `Remove stale ${input.profileKind} listing for ${normalizedUsername}`,
    });
  }

  for (const path of input.aggregatePaths) {
    const existing = await readFile(path, input.branch);
    const existingJson = existing ? parseJson(existing.content) : [];
    await writeFile({
      path,
      branch: input.branch,
      content: stringifyJson(
        projectProfileMembership(existingJson, input.profile)
      ),
      message: `Update ${input.profileKind} listing for ${normalizedUsername}`,
    });
  }
}

async function regenerateSearchIndex(branch: string): Promise<void> {
  /* This whole-directory scan is intentionally outside entity-versioned operations. */
  const userPaths = await listDirectoryFiles('public/people/v2/users', branch);
  const entries = [];

  for (const userPath of userPaths.filter((path) => path.endsWith('.json'))) {
    const file = await readFile(userPath, branch);
    if (!file) continue;

    const value = parseJson(file.content);
    const parsed = JsonRecordSchema.safeParse(value);
    if (!parsed.success) continue;

    const entry = searchEntryForProfile(parsed.data);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));

  await writeFile({
    path: SEARCH_INDEX_PATH,
    branch,
    content: stringifyJson(entries),
    message: 'Regenerate public people search index',
  });
}

function openPublicProfilePrResult(input: {
  number: number;
  url: string;
  branch: string;
  headSha?: string;
  updatedAt?: string;
  profileKind: PublicProfileKind;
  stream?: string;
  userPath: string;
  aggregatePaths: string[];
  profile: PublicProfile;
}): PublicProfilePrResult {
  return {
    status: 'open',
    number: input.number,
    url: input.url,
    branch: input.branch,
    headSha: input.headSha,
    canEdit: true,
    updatedAt: input.updatedAt,
    profileKind: input.profileKind,
    stream: input.stream ?? inferSpecialStream(input.aggregatePaths),
    targetUserFile: input.userPath,
    targetAggregateFiles: input.aggregatePaths,
    draftProfile: input.profile,
  };
}

async function addProfilePrUpdateComment(input: {
  issueNumber: number;
  username: string;
  updatedBy: string;
  updatedByType?: 'self' | 'admin';
  branch: string;
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const actorLabel =
    input.updatedByType === 'admin'
      ? 'Admin edit'
      : input.updatedByType === 'self'
        ? 'User edit'
        : 'Profile edit';

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: input.issueNumber,
    body: [
      `**${actorLabel}**`,
      '',
      `Profile draft for \`${normalizeUsername(input.username)}\` was updated by \`${input.updatedBy}\`.`,
      `Branch: \`${input.branch}\``,
    ].join('\n'),
  });
}

async function updateProfilePullRequestBody(input: {
  issueNumber: number;
  username: string;
  updatedBy: string;
  profileKind: PublicProfileKind;
  userPath: string;
  aggregatePaths: string[];
}) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;

  await octokit.pulls.update({
    owner,
    repo,
    pull_number: input.issueNumber,
    body: profilePullRequestBody(input),
  });
}

async function findProfilePullRequest(
  username: string,
  state: 'open' | 'closed' | 'all'
) {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const normalized = normalizeUsername(username);
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
        pull.head.ref.startsWith(`profile/${normalized}`) ||
        body.includes(`username: ${normalized}`)
      );
    }) ?? null
  );
}

export function publishedProfileMetadataFromProfile(input: {
  username: string;
  profile: Record<string, unknown>;
}): {
  profileKind?: PublicProfileKind;
  stream?: string;
  targetAggregateFiles: string[];
} {
  const staffPath = staffAggregatePathForProfile(input.profile);
  if (staffPath) {
    const departmentStaffPath = departmentStaffAggregatePathForProfile(
      input.profile
    );
    return {
      profileKind: inferProfileKind(input.profile),
      targetAggregateFiles: [
        staffPath,
        ...(departmentStaffPath ? [departmentStaffPath] : []),
      ],
    };
  }

  const batch = studentBatchFromIdentity(input.username);
  if (!batch) {
    return { targetAggregateFiles: [] };
  }

  const studentPath = `public/people/v2/students/${batch}.json`;
  const honoursProgramme = input.profile.honoursProgramme;
  const stream =
    typeof honoursProgramme === 'string' &&
    honoursProgramme in HonoursProgrammeStudentStreamMap
      ? HonoursProgrammeStudentStreamMap[
          honoursProgramme as keyof typeof HonoursProgrammeStudentStreamMap
        ]
      : undefined;
  if (input.profile.studentTrack === 'HONOURS' && stream) {
    return {
      profileKind: 'student',
      stream,
      targetAggregateFiles: [
        studentPath,
        `public/people/v2/special/${stream}/${batch}.json`,
      ],
    };
  }

  return {
    profileKind: 'student',
    targetAggregateFiles: [studentPath],
  };
}

export async function getPublicProfile(
  username: string
): Promise<PublicProfileResult | null> {
  const normalizedUsername = normalizeUsername(username);
  const path = `public/people/v2/users/${normalizedUsername}.json`;
  const entry = await readFile(path);
  if (!entry) return null;
  const profile = JsonRecordSchema.parse(JSON.parse(entry.content));
  const metadata = publishedProfileMetadataFromProfile({
    username: normalizedUsername,
    profile,
  });

  return {
    profile,
    ...metadata,
    targetUserFile: path,
  };
}

export async function getPublicProfilePrStatus(
  username: string
): Promise<PublicProfilePrStatus> {
  const normalizedUsername = normalizeUsername(username);
  const currentUserFileSha =
    (await readFile(`public/people/v2/users/${normalizedUsername}.json`))
      ?.sha ?? null;
  const openPull = await findProfilePullRequest(username, 'open');
  if (openPull) {
    const metadata = parseProfilePullRequestBody(openPull.body ?? '');
    const targetUserFile =
      metadata.targetUserFile ??
      `public/people/v2/users/${normalizedUsername}.json`;
    const draftEntry = await readFile(targetUserFile, openPull.head.ref);
    const draftValue = draftEntry ? parseJson(draftEntry.content) : null;
    const parsedDraft = JsonRecordSchema.safeParse(draftValue);
    const draftProfile = parsedDraft.success ? parsedDraft.data : null;
    const profileKind = metadata.profileKind ?? inferProfileKind(draftProfile);

    return {
      status: 'open',
      number: openPull.number,
      url: openPull.html_url,
      branch: openPull.head.ref,
      headSha: openPull.head.sha,
      currentUserFileSha,
      revision: draftEntry?.sha,
      canEdit: true,
      updatedAt: openPull.updated_at,
      profileKind,
      stream:
        metadata.stream ?? inferSpecialStream(metadata.targetAggregateFiles),
      targetUserFile,
      targetAggregateFiles: metadata.targetAggregateFiles,
      draftProfile,
    };
  }

  const latestPull = await findProfilePullRequest(username, 'closed');
  if (!latestPull) {
    return {
      status: 'none',
      canEdit: false,
      currentUserFileSha,
      revision: currentUserFileSha ?? undefined,
    };
  }

  return {
    status: latestPull.merged_at ? 'merged' : 'closed',
    number: latestPull.number,
    url: latestPull.html_url,
    branch: latestPull.head.ref,
    headSha: latestPull.head.sha,
    currentUserFileSha,
    revision: currentUserFileSha ?? undefined,
    canEdit: false,
    updatedAt: latestPull.updated_at,
  };
}

export async function upsertPublicProfilePr(
  input: UpdatePublicProfileInput
): Promise<PublicProfilePrResult> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const normalizedUsername = normalizeUsername(input.username);
  const existingPull = await findProfilePullRequest(normalizedUsername, 'open');
  let branch = existingPull?.head.ref;
  const { defaultBranch, sha } = await getDefaultBranchSha();

  if (existingPull) {
    if (!input.expectedPrHeadSha) {
      throw new PublicProfileRequestError(
        409,
        'A public profile draft was created after this editor loaded'
      );
    }

    if (existingPull.head.sha !== input.expectedPrHeadSha) {
      throw new PublicProfileRequestError(
        409,
        'Public profile draft changed after it was loaded'
      );
    }
  }

  if (!existingPull && input.expectedUserFileSha !== undefined) {
    const currentUserFile = await readFile(input.userPath);
    const currentSha = currentUserFile?.sha ?? null;
    if (currentSha !== input.expectedUserFileSha) {
      throw new PublicProfileRequestError(
        409,
        'Public profile changed after it was loaded'
      );
    }
  }

  if (!branch) {
    branch = createBranchName(normalizedUsername);
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  await writeFile({
    path: input.userPath,
    branch,
    content: stringifyJson(input.profile),
    message: `Update public profile for ${normalizedUsername}`,
  });

  await reconcileAggregateFiles({
    branch,
    username: normalizedUsername,
    profileKind: input.profileKind,
    aggregatePaths: input.aggregatePaths,
    profile: input.profile,
  });
  await regenerateSearchIndex(branch);

  if (existingPull) {
    await updateProfilePullRequestBody({
      issueNumber: existingPull.number,
      username: normalizedUsername,
      updatedBy: input.updatedBy,
      profileKind: input.profileKind,
      userPath: input.userPath,
      aggregatePaths: input.aggregatePaths,
    });

    await addProfilePrUpdateComment({
      issueNumber: existingPull.number,
      username: normalizedUsername,
      updatedBy: input.updatedBy,
      updatedByType: input.updatedByType,
      branch,
    });

    return openPublicProfilePrResult({
      number: existingPull.number,
      url: existingPull.html_url,
      branch,
      headSha: await getBranchHeadSha(branch),
      updatedAt: new Date().toISOString(),
      profileKind: input.profileKind,
      userPath: input.userPath,
      aggregatePaths: input.aggregatePaths,
      profile: input.profile,
    });
  }

  const pullRequest = await octokit.pulls.create({
    owner,
    repo,
    title: `Update public profile for ${normalizedUsername}`,
    body: profilePullRequestBody({
      username: normalizedUsername,
      updatedBy: input.updatedBy,
      profileKind: input.profileKind,
      userPath: input.userPath,
      aggregatePaths: input.aggregatePaths,
    }),
    head: branch,
    base: defaultBranch,
  });

  for (const label of PROFILE_LABELS) {
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

  return openPublicProfilePrResult({
    number: pullRequest.data.number,
    url: pullRequest.data.html_url,
    branch,
    headSha: await getBranchHeadSha(branch),
    updatedAt: pullRequest.data.updated_at,
    profileKind: input.profileKind,
    userPath: input.userPath,
    aggregatePaths: input.aggregatePaths,
    profile: input.profile,
  });
}

export async function discardPublicProfilePr(
  input: DiscardPublicProfilePrInput
): Promise<{ success: true }> {
  const octokit = getOctokit();
  const owner = envConfig.GITHUB_OWNER;
  const repo = envConfig.GITHUB_PEOPLE_DATA_REPOSITORY;
  const pull = await octokit.pulls.get({
    owner,
    repo,
    pull_number: input.prNumber,
  });
  const normalizedUsername = normalizeUsername(input.username);
  const body = pull.data.body ?? '';
  const hasProfileLabel = pull.data.labels.some(
    (label) => label.name === 'profile-update'
  );
  const hasAutoMergeLabel = pull.data.labels.some(
    (label) => label.name === 'auto-merge-profile'
  );

  if (
    pull.data.state !== 'open' ||
    pull.data.head.sha !== input.expectedHeadSha ||
    !pull.data.head.ref.startsWith(`profile/${normalizedUsername}`) ||
    !body.includes(`username: ${normalizedUsername}`) ||
    !hasProfileLabel ||
    !hasAutoMergeLabel
  ) {
    throw new PublicProfileRequestError(
      409,
      'Public profile draft changed or is not controlled'
    );
  }

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: input.prNumber,
    body: [
      `Stale public profile draft closed by \`${input.updatedBy}\`.`,
      '',
      `Reason: ${input.reason}`,
      '',
      'No public data files were changed by this action.',
    ].join('\n'),
  });

  await octokit.pulls.update({
    owner,
    repo,
    pull_number: input.prNumber,
    state: 'closed',
  });

  if (pull.data.head.repo?.full_name === `${owner}/${repo}`) {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${pull.data.head.ref}`,
    });
  }

  return { success: true };
}
