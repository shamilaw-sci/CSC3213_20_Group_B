import type { Octokit } from '@octokit/rest';

import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import type { AcademicOperationRequest } from '@/domains/academics/academic.operation';
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

export interface AcademicDraftResult {
  revision: string;
  pullRequest?: { number: number; url: string };
}

export interface AcademicDraftRepository {
  saveDraft(
    request: AcademicOperationRequest,
    context: { operationId: string }
  ): Promise<AcademicDraftResult>;
}

export class AcademicRevisionConflictError extends Error {
  readonly status = 409;

  constructor(
    public readonly expectedRevision: string,
    public readonly currentRevision: string
  ) {
    super(
      `Academic record revision changed from ${expectedRevision} to ${currentRevision}`
    );
    this.name = 'AcademicRevisionConflictError';
  }
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizedRevision(revision: string | null): string {
  return revision ?? 'missing';
}

function requestedContent(request: AcademicOperationRequest): string | null {
  return request.action === 'delete' ? null : stringifyJson(request.record);
}

function hasRequestedContent(
  current: string | null | undefined,
  request: AcademicOperationRequest
): boolean {
  if (request.action === 'delete') return current === null;
  if (!current || !request.record) return false;
  try {
    return (
      JSON.stringify(JSON.parse(current)) === JSON.stringify(request.record)
    );
  } catch {
    return false;
  }
}

function operationBody(input: {
  operationId: string;
  request: AcademicOperationRequest;
  revision: string;
}): string {
  return [
    '<!-- scs-operation',
    `operationId: ${input.operationId}`,
    `resourceType: ${input.request.kind}`,
    `resourceId: ${input.request.id}`,
    `entityRevision: ${input.revision}`,
    `authoritativeFile: ${input.request.recordPath}`,
    `action: ${input.request.action}`,
    '-->',
    '',
    `Automated ${input.request.kind} ${input.request.action} requested by ${input.request.updatedBy}.`,
  ].join('\n');
}

function branchPrefix(request: AcademicOperationRequest): string {
  const resource = request.kind === 'course' ? 'course' : 'course-offering';
  return request.action === 'delete' ? `${resource}-delete` : resource;
}

export class GithubAcademicDraftRepository implements AcademicDraftRepository {
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
    request: AcademicOperationRequest,
    context: { operationId: string }
  ): Promise<AcademicDraftResult> {
    const resourceType = request.kind;
    const openPull = await this.pullRequestGateway.findOpen((pullRequest) => {
      const metadata = parsePullRequestOperationMetadata(pullRequest.body);
      return (
        (metadata?.resourceType === resourceType &&
          metadata.resourceId === request.id) ||
        pullRequest.head.ref.startsWith(`course/${request.id}-`) ||
        pullRequest.head.ref.startsWith(`course-delete/${request.id}-`) ||
        pullRequest.head.ref.startsWith(`course-offering/${request.id}-`) ||
        pullRequest.head.ref.startsWith(`course-offering-delete/${request.id}-`)
      );
    });
    const defaultBranch = await this.repositoryGateway.getDefaultBranch();
    const branch =
      openPull?.head.ref ??
      `${branchPrefix(request)}/${request.id}-${context.operationId.slice(-12)}`;
    const parentSha = openPull
      ? await this.repositoryGateway.getRefSha(`heads/${branch}`)
      : defaultBranch.sha;
    const snapshot = await this.repositoryGateway.readSnapshot(parentSha, [
      request.recordPath,
    ]);
    const currentRevision = normalizedRevision(
      snapshot.revisions.get(request.recordPath) ?? null
    );

    if (
      openPull &&
      hasRequestedContent(snapshot.files.get(request.recordPath), request)
    ) {
      await this.pullRequestGateway.updateBody(
        openPull.number,
        operationBody({
          operationId: context.operationId,
          request,
          revision: currentRevision,
        })
      );
      await this.ensureLabels(openPull.number, request);
      return {
        revision: currentRevision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }
    if (
      request.expectedRevision !== undefined &&
      request.expectedRevision !== currentRevision
    ) {
      throw new AcademicRevisionConflictError(
        request.expectedRevision,
        currentRevision
      );
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
      message: `${request.action === 'delete' ? 'Delete' : 'Update'} public ${request.kind} for ${request.id}`,
      changes: [
        { path: request.recordPath, content: requestedContent(request) },
      ],
    });
    const revision = normalizedRevision(
      commit.changedFileShas.get(request.recordPath) ?? null
    );
    const body = operationBody({
      operationId: context.operationId,
      request,
      revision,
    });

    if (openPull) {
      await this.pullRequestGateway.updateBody(openPull.number, body);
      await this.ensureLabels(openPull.number, request);
      return {
        revision,
        pullRequest: { number: openPull.number, url: openPull.html_url },
      };
    }

    const pullRequest = await this.pullRequestGateway.create({
      title: `${request.action === 'delete' ? 'Delete' : 'Update'} public ${request.kind} for ${request.id}`,
      body,
      head: branch,
      base: defaultBranch.name,
    });
    await this.ensureLabels(pullRequest.number, request);
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
    request: AcademicOperationRequest
  ): Promise<void> {
    const prefix = request.kind === 'course' ? 'course' : 'course-offering';
    await this.octokit.issues.addLabels({
      ...this.repository,
      issue_number: pullNumber,
      labels: [
        `${prefix}-${request.action === 'delete' ? 'delete' : 'update'}`,
        'auto-merge-course',
      ],
    });
  }
}

export function createAcademicDraftRepository(): AcademicDraftRepository {
  const config = getRuntimeConfig();
  const octokit = getOctokit();
  return new GithubAcademicDraftRepository(
    createGithubClient(octokit),
    octokit,
    {
      owner: config.GITHUB_OWNER,
      repo: config.GITHUB_PROJECTS_DATA_REPOSITORY,
    }
  );
}
