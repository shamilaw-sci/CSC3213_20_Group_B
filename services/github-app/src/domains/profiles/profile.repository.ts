import type { Octokit } from '@octokit/rest';

import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import { assertSelfHonoursUnchanged } from '@/domains/profiles/honours-guard';
import type { ProfileDraftRequest } from '@/domains/profiles/profile.types';
import { createAtomicCommit } from '@/github/atomic-commit';
import { createGithubClient } from '@/github/github.client';
import type {
  GithubClient,
  RepositoryCoordinates,
} from '@/github/github.types';
import {
  parsePullRequestOperationMetadata,
  PullRequestGateway,
} from '@/github/pull-request.gateway';
import { RepositoryGateway } from '@/github/repository.gateway';

export interface ProfileDraftResult {
  revision: string;
  pullRequest: { number: number; url: string };
}

export interface ProfileDraftRepository {
  saveDraft(
    request: ProfileDraftRequest,
    context?: { operationId: string }
  ): Promise<ProfileDraftResult>;
}

export class ProfileRevisionConflictError extends Error {
  readonly status = 409;

  constructor(
    public readonly expectedRevision: string,
    public readonly currentRevision: string
  ) {
    super(
      `Profile revision changed from ${expectedRevision} to ${currentRevision}`
    );
    this.name = 'ProfileRevisionConflictError';
  }
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function operationBody(input: {
  operationId: string;
  request: ProfileDraftRequest;
  revision: string;
}): string {
  return [
    '<!-- scs-operation',
    `operationId: ${input.operationId}`,
    'resourceType: profile',
    `resourceId: ${input.request.username}`,
    `entityRevision: ${input.revision}`,
    `authoritativeFile: ${input.request.userPath}`,
    '-->',
    '<!-- profile-update',
    `username: ${input.request.username}`,
    `profileKind: ${input.request.profileKind}`,
    `targetUserFile: ${input.request.userPath}`,
    'targetAggregateFiles:',
    ...input.request.aggregatePaths.map((path) => `- ${path}`),
    '-->',
    '',
    `Automated public profile update requested by ${input.request.updatedBy}.`,
  ].join('\n');
}

function normalizedRevision(revision: string | null): string {
  return revision ?? 'missing';
}

function hasRequestedProfile(
  content: string | null | undefined,
  profile: ProfileDraftRequest['profile']
): boolean {
  if (!content) return false;
  try {
    return JSON.stringify(JSON.parse(content)) === JSON.stringify(profile);
  } catch {
    return false;
  }
}

export class GithubProfileDraftRepository implements ProfileDraftRepository {
  private readonly repositoryGateway: RepositoryGateway;
  private readonly pullRequestGateway: PullRequestGateway;

  constructor(
    private readonly client: GithubClient,
    private readonly octokit: Octokit,
    private readonly repository: RepositoryCoordinates
  ) {
    this.repositoryGateway = new RepositoryGateway(client, repository);
    this.pullRequestGateway = new PullRequestGateway(client, repository);
  }

  async saveDraft(
    request: ProfileDraftRequest,
    context = { operationId: `legacy-profile-${request.username}` }
  ): Promise<ProfileDraftResult> {
    const openPull = await this.pullRequestGateway.findOpen((pullRequest) => {
      const metadata = parsePullRequestOperationMetadata(pullRequest.body);
      return (
        (metadata?.resourceType === 'profile' &&
          metadata.resourceId === request.username) ||
        pullRequest.head.ref.startsWith(`profile/${request.username}-`)
      );
    });
    const defaultBranch = await this.repositoryGateway.getDefaultBranch();
    const branch =
      openPull?.head.ref ??
      `profile/${request.username}-${context.operationId.slice(-12)}`;
    const parentSha = openPull
      ? await this.repositoryGateway.getRefSha(`heads/${branch}`)
      : defaultBranch.sha;
    const snapshot = await this.repositoryGateway.readSnapshot(parentSha, [
      request.userPath,
    ]);
    if (request.profileKind === 'student' && request.updatedByType === 'self') {
      const publishedSnapshot = openPull
        ? await this.repositoryGateway.readSnapshot(defaultBranch.sha, [
            request.userPath,
          ])
        : snapshot;
      assertSelfHonoursUnchanged({
        ...request,
        currentContent: publishedSnapshot.files.get(request.userPath),
      });
      if (openPull) {
        assertSelfHonoursUnchanged({
          ...request,
          currentContent: snapshot.files.get(request.userPath),
        });
      }
    }
    const currentRevision = normalizedRevision(
      snapshot.revisions.get(request.userPath) ?? null
    );
    if (
      openPull &&
      currentRevision !== 'missing' &&
      hasRequestedProfile(snapshot.files.get(request.userPath), request.profile)
    ) {
      await this.pullRequestGateway.updateBody(
        openPull.number,
        operationBody({
          operationId: context.operationId,
          request,
          revision: currentRevision,
        })
      );
      await this.ensureLabels(openPull.number);
      return {
        revision: currentRevision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }
    if (
      request.expectedRevision !== undefined &&
      request.expectedRevision !== currentRevision
    ) {
      throw new ProfileRevisionConflictError(
        request.expectedRevision,
        currentRevision
      );
    }

    if (!openPull) {
      await this.repositoryGateway.createBranch(branch, defaultBranch.sha);
    }
    const commit = await createAtomicCommit(this.client, {
      repository: this.repository,
      ref: `heads/${branch}`,
      expectedParentSha: parentSha,
      message: `Update public profile for ${request.username}`,
      changes: [
        { path: request.userPath, content: stringifyJson(request.profile) },
      ],
    });
    const revision = commit.changedFileShas.get(request.userPath);
    if (!revision) throw new Error('Profile commit did not create a user blob');
    const body = operationBody({
      operationId: context.operationId,
      request,
      revision,
    });

    if (openPull) {
      await this.pullRequestGateway.updateBody(openPull.number, body);
      await this.ensureLabels(openPull.number);
      return {
        revision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }

    const pullRequest = await this.pullRequestGateway.create({
      title: `Update public profile for ${request.username}`,
      body,
      head: branch,
      base: defaultBranch.name,
    });
    await this.ensureLabels(pullRequest.number);
    return {
      revision,
      pullRequest: {
        number: pullRequest.number,
        url: pullRequest.html_url,
      },
    };
  }

  private async ensureLabels(pullNumber: number): Promise<void> {
    await this.octokit.issues.addLabels({
      ...this.repository,
      issue_number: pullNumber,
      labels: ['profile-update', 'auto-merge-profile'],
    });
  }
}

export function createProfileDraftRepository(): ProfileDraftRepository {
  const config = getRuntimeConfig();
  const octokit = getOctokit();
  return new GithubProfileDraftRepository(
    createGithubClient(octokit),
    octokit,
    {
      owner: config.GITHUB_OWNER,
      repo: config.GITHUB_PEOPLE_DATA_REPOSITORY,
    }
  );
}
