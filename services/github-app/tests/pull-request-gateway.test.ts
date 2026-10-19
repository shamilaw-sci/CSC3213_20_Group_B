import { describe, expect, test } from 'bun:test';

import {
  parsePullRequestOperationMetadata,
  PullRequestGateway,
} from '@/github/pull-request.gateway';
import type { GithubClient, GithubPullRequest } from '@/github/github.types';

function pullRequest(number: number): GithubPullRequest {
  return {
    number,
    html_url: `https://github.test/pulls/${number}`,
    body: null,
    head: { ref: `automation/${number}`, sha: `sha-${number}` },
  };
}

describe('GitHub pull request gateway', () => {
  test('paginates open pull requests until it finds a match', async () => {
    const requestedPages: number[] = [];
    const client = {
      pulls: {
        list: async ({ page }: { page: number }) => {
          requestedPages.push(page);
          return {
            data:
              page === 1
                ? Array.from({ length: 100 }, (_, index) =>
                    pullRequest(index + 1)
                  )
                : [pullRequest(101)],
          };
        },
      },
    } as unknown as GithubClient;
    const gateway = new PullRequestGateway(client, {
      owner: 'scs',
      repo: 'config',
    });

    const match = await gateway.findOpen((pull) => pull.number === 101);

    expect(match?.number).toBe(101);
    expect(requestedPages).toEqual([1, 2]);
  });

  test('parses structured operation metadata without executing its contents', () => {
    expect(
      parsePullRequestOperationMetadata(`
Update a record.

<!-- scs-operation
operationId: operation-123
resourceType: project
resourceId: example
ignored: value
-->
`)
    ).toEqual({
      operationId: 'operation-123',
      resourceType: 'project',
      resourceId: 'example',
    });
    expect(parsePullRequestOperationMetadata('ordinary body')).toBeNull();
  });
});
