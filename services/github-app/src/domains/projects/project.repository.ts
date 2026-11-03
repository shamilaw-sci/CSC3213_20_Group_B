import type { Octokit } from '@octokit/rest';

import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import type { ProjectOperationRequest } from '@/domains/projects/project.operation';
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

export interface ProjectDraftResult {
  revision: string;
  pullRequest?: { number: number; url: string };
}

export interface ProjectDraftRepository {
  saveDraft(
    request: ProjectOperationRequest,
    context: { operationId: string }
  ): Promise<ProjectDraftResult>;
}

export class ProjectRevisionConflictError extends Error {
  readonly status = 409;

  constructor(
    public readonly expectedRevision: string,
    public readonly currentRevision: string
  ) {
    super(
      `Project revision changed from ${expectedRevision} to ${currentRevision}`
    );
    this.name = 'ProjectRevisionConflictError';
  }
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizedRevision(revision: string | null): string {
  return revision ?? 'missing';
}

function requestedContent(request: ProjectOperationRequest): string | null {
  return request.action === 'delete' ? null : stringifyJson(request.project);
}

function destinationPath(request: ProjectOperationRequest): string {
  if (
    request.action === 'upsert' &&
    typeof request.project?.slug === 'string'
  ) {
    return `public/projects/v2/projects/${request.project.slug}.json`;
  }
  return request.projectPath;
}

function hasRequestedContent(
  current: string | null | undefined,
  request: ProjectOperationRequest
): boolean {
  if (request.action === 'delete') return current === null;
  if (!current || !request.project) return false;
  try {
    return (
      JSON.stringify(JSON.parse(current)) === JSON.stringify(request.project)
    );
  } catch {
    return false;
  }
}

function operationBody(input: {
  operationId: string;
  request: ProjectOperationRequest;
  revision: string;
}): string {
  return [
    '<!-- scs-operation',
    `operationId: ${input.operationId}`,
    'resourceType: project',
    `resourceId: ${input.request.slug}`,
    `entityRevision: ${input.revision}`,
    `authoritativeFile: ${destinationPath(input.request)}`,
    `action: ${input.request.action}`,
    '-->',
    '',
    `Automated project ${input.request.action} requested by ${input.request.updatedBy}.`,
  ].join('\n');
}

export class GithubProjectDraftRepository implements ProjectDraftRepository {
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
    request: ProjectOperationRequest,
    context: { operationId: string }
  ): Promise<ProjectDraftResult> {
    const openPull = await this.pullRequestGateway.findOpen((pullRequest) => {
      const metadata = parsePullRequestOperationMetadata(pullRequest.body);
      return (
        metadata?.resourceType === 'project' &&
        metadata.resourceId === request.slug
      );
    });
    const defaultBranch = await this.repositoryGateway.getDefaultBranch();
    const branch =
      openPull?.head.ref ??
      `${request.action === 'delete' ? 'project-delete' : 'project'}/${request.slug}-${context.operationId.slice(-12)}`;
    const parentSha = openPull
      ? await this.repositoryGateway.getRefSha(`heads/${branch}`)
      : defaultBranch.sha;
    const nextPath = destinationPath(request);
    const isRename = nextPath !== request.projectPath;
    const previousPath = (openPull?.body ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('authoritativeFile: '))
      ?.slice('authoritativeFile: '.length);
    const stalePath =
      previousPath &&
      /^public\/projects\/v2\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(
        previousPath
      ) &&
      previousPath !== request.projectPath &&
      previousPath !== nextPath
        ? previousPath
        : null;
    const snapshot = await this.repositoryGateway.readSnapshot(parentSha, [
      request.projectPath,
      ...(isRename ? [nextPath] : []),
      ...(stalePath ? [stalePath] : []),
    ]);
    const currentRevision = normalizedRevision(
      snapshot.revisions.get(request.projectPath) ?? null
    );

    if (
      openPull &&
      hasRequestedContent(snapshot.files.get(nextPath), request) &&
      (!isRename || snapshot.files.get(request.projectPath) === null) &&
      (!stalePath || snapshot.files.get(stalePath) === null)
    ) {
      await this.pullRequestGateway.updateBody(
        openPull.number,
        operationBody({
          operationId: context.operationId,
          request,
          revision: currentRevision,
        })
      );
      await this.ensureLabels(openPull.number, request.action);
      return {
        revision: currentRevision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }
    if (
      request.expectedRevision !== undefined &&
      request.expectedRevision !== currentRevision
    ) {
      throw new ProjectRevisionConflictError(
        request.expectedRevision,
        currentRevision
      );
    }
    if (isRename) {
      const destination = await this.repositoryGateway.readSnapshot(
        defaultBranch.sha,
        [nextPath]
      );
      if (destination.files.get(nextPath) !== null) {
        throw new ProjectRevisionConflictError(
          'missing',
          normalizedRevision(destination.revisions.get(nextPath) ?? null)
        );
      }
    }
    if (request.action === 'delete' && currentRevision === 'missing') {
      return { revision: currentRevision };
    }

    if (!openPull) {
      await this.repositoryGateway.createBranch(branch, defaultBranch.sha);
    }
    const commit = await createAtomicCommit(this.client, {
      repository: this.repository,
      ref: `heads/${branch}`,
      expectedParentSha: parentSha,
      message: `${request.action === 'delete' ? 'Delete' : 'Update'} public project for ${request.slug}`,
      changes: [
        ...(isRename && snapshot.files.get(request.projectPath) !== null
          ? [{ path: request.projectPath, content: null }]
          : []),
        ...(stalePath && snapshot.files.get(stalePath) !== null
          ? [{ path: stalePath, content: null }]
          : []),
        { path: nextPath, content: requestedContent(request) },
      ],
    });
    const revision = normalizedRevision(
      commit.changedFileShas.get(nextPath) ?? null
    );
    const body = operationBody({
      operationId: context.operationId,
      request,
      revision,
    });

    if (openPull) {
      await this.pullRequestGateway.updateBody(openPull.number, body);
      await this.ensureLabels(openPull.number, request.action);
      return {
        revision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }

    const pullRequest = await this.pullRequestGateway.create({
      title: `${request.action === 'delete' ? 'Delete' : 'Update'} public project for ${request.slug}`,
      body,
      head: branch,
      base: defaultBranch.name,
    });
    await this.ensureLabels(pullRequest.number, request.action);
    return {
      revision,
      pullRequest: {
        number: pullRequest.number,
        url: pullRequest.html_url,
      },
    };
  }

  private async ensureLabels(
    pullNumber: number,
    action: ProjectOperationRequest['action']
  ): Promise<void> {
    await this.octokit.issues.addLabels({
      ...this.repository,
      issue_number: pullNumber,
      labels: [
        action === 'delete' ? 'project-delete' : 'project-update',
        'auto-merge-project',
      ],
    });
  }
}

export function createProjectDraftRepository(): ProjectDraftRepository {
  const config = getRuntimeConfig();
  const octokit = getOctokit();
  return new GithubProjectDraftRepository(
    createGithubClient(octokit),
    octokit,
    {
      owner: config.GITHUB_OWNER,
      repo: config.GITHUB_PROJECTS_DATA_REPOSITORY,
    }
  );
}
