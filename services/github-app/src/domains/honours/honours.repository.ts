import {
  type HonoursBulkChange,
  type HonoursBulkOperationRequest,
  StudentSchema,
} from '@scs/schemas';

import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import { createAtomicCommit } from '@/github/atomic-commit';
import { createGithubClient } from '@/github/github.client';
import {
  parsePullRequestOperationMetadata,
  PullRequestGateway,
} from '@/github/pull-request.gateway';
import { RepositoryGateway } from '@/github/repository.gateway';
import { isGitHubNotFoundError } from '@/utils/github';
import { JsonRecordSchema } from '@/utils/json-record';

export interface HonoursBulkRepository {
  saveDraft(
    request: HonoursBulkOperationRequest,
    operationId: string
  ): Promise<{
    revision: string;
    pullRequest: { number: number; url: string };
  }>;
}

export class HonoursBulkConflictError extends Error {
  readonly status = 409;
}

export function applyHonoursChange(
  value: unknown,
  change: HonoursBulkChange
): Record<string, unknown> {
  const record = JsonRecordSchema.parse(value);
  const student = StudentSchema.parse(record);
  if (
    student.registrationNo !== change.identifier ||
    student.studentType !== 'UNDERGRADUATE' ||
    (student.studentTrack ?? null) !== change.oldTrack ||
    (student.honoursProgramme ?? null) !== change.oldProgramme
  ) {
    throw new HonoursBulkConflictError(
      `Student classification changed for ${change.identifier}`
    );
  }
  const next: Record<string, unknown> = {
    ...record,
    studentTrack: change.newTrack,
  };
  if (change.newProgramme) next.honoursProgramme = change.newProgramme;
  else delete next.honoursProgramme;
  StudentSchema.parse(next);
  return next;
}

function filePath(identifier: string): string {
  return `public/people/v2/users/${identifier.toLowerCase()}.json`;
}

export function honoursBranch(batch: string, operationId: string): string {
  return `profile/${batch}-${operationId.slice(-12)}`;
}

export function createHonoursBulkRepository(): HonoursBulkRepository {
  const config = getRuntimeConfig();
  const octokit = getOctokit();
  const client = createGithubClient(octokit);
  const repository = {
    owner: config.GITHUB_OWNER,
    repo: config.GITHUB_PEOPLE_DATA_REPOSITORY,
  };
  const gateway = new RepositoryGateway(client, repository);
  const pulls = new PullRequestGateway(client, repository);
  return {
    async saveDraft(request, operationId) {
      // The public-data projection and merge workflows process profile/* PRs.
      const branch = honoursBranch(request.batch, operationId);
      const body = [
        '<!-- scs-operation',
        `operationId: ${operationId}`,
        'resourceType: honours_batch',
        `resourceId: ${request.batch}`,
        '-->',
        '',
        `Honours ${request.operation} for ${request.batch}.`,
        `Requested by: ${request.updatedBy}`,
        `Reason: ${request.reason}`,
        '',
        ...request.changes.map(
          (change) =>
            `- ${change.identifier}: ${change.oldTrack ?? 'none'}/${change.oldProgramme ?? 'none'} → ${change.newTrack}/${change.newProgramme ?? 'none'}`
        ),
      ].join('\n');
      const existingPull = await pulls.findOpen(
        (pull) =>
          parsePullRequestOperationMetadata(pull.body)?.operationId ===
          operationId
      );
      if (existingPull) {
        // A prior attempt may have created the PR but failed before labelling it.
        await octokit.issues.addLabels({
          ...repository,
          issue_number: existingPull.number,
          labels: ['profile-update', 'auto-merge-profile'],
        });
        return {
          revision:
            existingPull.head.sha ??
            (await gateway.getRefSha(`heads/${branch}`)),
          pullRequest: {
            number: existingPull.number,
            url: existingPull.html_url,
          },
        };
      }
      const priorPulls = await octokit.pulls.list({
        ...repository,
        head: `${repository.owner}:${branch}`,
        state: 'closed',
        per_page: 100,
      });
      const priorPull = priorPulls.data.find(
        (pull) =>
          parsePullRequestOperationMetadata(pull.body)?.operationId ===
          operationId
      );
      if (priorPull) {
        if (!priorPull.merged_at) {
          throw new HonoursBulkConflictError(
            'The Honours pull request was closed without publication'
          );
        }
        return {
          revision: priorPull.head.sha,
          pullRequest: { number: priorPull.number, url: priorPull.html_url },
        };
      }
      const defaultBranch = await gateway.getDefaultBranch();
      const paths = request.changes.map((change) =>
        filePath(change.identifier)
      );
      const snapshot = await gateway.readSnapshot(defaultBranch.sha, paths);
      const proposed = request.changes.map((change) => {
        const path = filePath(change.identifier);
        const raw = snapshot.files.get(path);
        if (!raw)
          throw new HonoursBulkConflictError(
            `Published profile missing for ${change.identifier}`
          );
        return {
          path,
          content: `${JSON.stringify(applyHonoursChange(JSON.parse(raw), change), null, 2)}\n`,
        };
      });
      let parentSha: string;
      try {
        parentSha = await gateway.getRefSha(`heads/${branch}`);
      } catch (error) {
        if (!isGitHubNotFoundError(error)) throw error;
        await gateway.createBranch(branch, defaultBranch.sha);
        parentSha = defaultBranch.sha;
      }
      if (parentSha !== defaultBranch.sha) {
        const branchSnapshot = await gateway.readSnapshot(parentSha, paths);
        const alreadyCommitted = proposed.every(({ path, content }) => {
          const current = branchSnapshot.files.get(path);
          return (
            current &&
            JSON.stringify(JSON.parse(current)) ===
              JSON.stringify(JSON.parse(content))
          );
        });
        if (!alreadyCommitted)
          throw new HonoursBulkConflictError(
            'Bulk branch changed; review before retry'
          );
      } else {
        const commit = await createAtomicCommit(client, {
          repository,
          ref: `heads/${branch}`,
          expectedParentSha: parentSha,
          message: `Update Honours classifications for ${request.batch}`,
          changes: proposed,
        });
        parentSha = commit.commitSha;
      }
      const pull = await pulls.create({
        title: `Update Honours classifications for ${request.batch}`,
        body,
        head: branch,
        base: defaultBranch.name,
      });
      await octokit.issues.addLabels({
        ...repository,
        issue_number: pull.number,
        labels: ['profile-update', 'auto-merge-profile'],
      });
      return {
        revision: parentSha,
        pullRequest: { number: pull.number, url: pull.html_url },
      };
    },
  };
}
