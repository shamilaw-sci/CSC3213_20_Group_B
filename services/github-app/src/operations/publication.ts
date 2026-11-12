import type { PublicationState } from '@scs/schemas';

import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import { parsePullRequestOperationMetadata } from '@/github/pull-request.gateway';
import type { OperationRecord } from '@/operations/operation.types';

export function repositoryFor(operation: OperationRecord): string {
  const config = getRuntimeConfig();
  return operation.resource.type === 'profile'
    ? config.GITHUB_PEOPLE_DATA_REPOSITORY
    : config.GITHUB_PROJECTS_DATA_REPOSITORY;
}

function expectedBranch(operation: OperationRecord, branch: string): boolean {
  const prefixes: Record<string, string[]> = {
    profile: ['profile'],
    project: ['project', 'project-delete'],
    course: ['course', 'course-delete'],
    offering: ['course-offering', 'course-offering-delete'],
  };
  return (prefixes[operation.resource.type] ?? []).some((prefix) => {
    const start = `${prefix}/${operation.resource.id}-`;
    return (
      branch.startsWith(start) &&
      /^[a-f0-9]{12}$/u.test(branch.slice(start.length))
    );
  });
}

export interface PublicationSnapshot {
  state: PublicationState;
  cleanupEligible: boolean;
  branch?: string;
  headSha?: string;
}

export async function inspectPublication(
  operation: OperationRecord,
  octokit = getOctokit()
): Promise<PublicationSnapshot> {
  if (operation.cleanup?.status === 'complete') {
    return { state: 'cleaned_up', cleanupEligible: false };
  }
  const pullRequest =
    operation.outcome?.status === 'succeeded'
      ? operation.outcome.pullRequest
      : undefined;
  if (!pullRequest) return { state: 'unknown', cleanupEligible: false };

  const config = getRuntimeConfig();
  const owner = config.GITHUB_OWNER;
  const repo = repositoryFor(operation);
  const installation = await octokit.apps.getInstallation({
    installation_id: Number(config.GITHUB_INSTALLATION_ID),
  });
  const appSlug = installation.data.app_slug;
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullRequest.number,
  });
  const pull = response.data;
  const metadata = parsePullRequestOperationMetadata(pull.body);
  const trusted =
    pull.html_url === pullRequest.url &&
    pull.base.repo?.full_name === `${owner}/${repo}` &&
    (pull.head.repo?.full_name === `${owner}/${repo}` ||
      (Boolean(operation.cleanup) &&
        pull.state === 'closed' &&
        pull.head.repo === null)) &&
    installation.data.app_id === Number(config.GITHUB_APP_ID) &&
    pull.user?.type === 'Bot' &&
    pull.user.login.toLowerCase() === `${appSlug}[bot]`.toLowerCase() &&
    expectedBranch(operation, pull.head.ref) &&
    metadata?.operationId === operation.operationId &&
    metadata.resourceType === operation.resource.type &&
    metadata.resourceId === operation.resource.id;
  if (!trusted) return { state: 'superseded', cleanupEligible: false };

  if (pull.merged_at) {
    if (pull.merge_commit_sha) {
      try {
        const runs = await octokit.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: 'deploy.yml',
          head_sha: pull.merge_commit_sha,
          per_page: 10,
        });
        if (
          runs.data.workflow_runs.some(
            (run) => run.conclusion === 'success' && run.head_branch === 'main'
          )
        ) {
          return { state: 'published', cleanupEligible: false };
        }
      } catch {
        // A missing Actions read grant leaves the more conservative merged state.
      }
    }
    return { state: 'merged', cleanupEligible: false };
  }
  if (pull.state !== 'open') {
    return operation.cleanup
      ? {
          state: 'cleanup_partial',
          cleanupEligible: true,
          branch: operation.cleanup.branch,
          headSha: operation.cleanup.headSha,
        }
      : { state: 'closed', cleanupEligible: false };
  }

  try {
    let validation:
      | Awaited<
          ReturnType<typeof octokit.checks.listForRef>
        >['data']['check_runs'][number]
      | undefined;
    const refs = new Set(
      [pull.head.sha, pull.merge_commit_sha].filter((sha): sha is string =>
        Boolean(sha)
      )
    );
    for (const ref of refs) {
      const checks = await octokit.checks.listForRef({
        owner,
        repo,
        ref,
        per_page: 100,
        filter: 'latest',
      });
      validation = checks.data.check_runs.find(
        (check) => check.name === 'Validate Public Data'
      );
      if (validation) break;
    }
    if (
      validation?.status === 'completed' &&
      ['failure', 'timed_out', 'action_required'].includes(
        validation.conclusion ?? ''
      )
    ) {
      return {
        state: 'checks_failed',
        cleanupEligible: true,
        branch: pull.head.ref,
        headSha: pull.head.sha,
      };
    }
    if (validation && validation.status !== 'completed') {
      return { state: 'checks_pending', cleanupEligible: false };
    }
    if (validation?.conclusion === 'success') {
      return {
        state: pull.auto_merge ? 'auto_merge_queued' : 'checks_passed',
        cleanupEligible: false,
      };
    }
  } catch {
    // Validation visibility depends on the installation's Checks read grant.
  }
  return { state: 'pr_open', cleanupEligible: false };
}
