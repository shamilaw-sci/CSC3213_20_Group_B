import type {
  GithubClient,
  GithubPullRequest,
  PullRequestOperationMetadata,
  RepositoryCoordinates,
} from '@/github/github.types';

const MAX_PULL_REQUEST_PAGES = 10;
const PAGE_SIZE = 100;

export function parsePullRequestOperationMetadata(
  body: string | null
): PullRequestOperationMetadata | null {
  if (!body) return null;
  const block = body.match(/<!-- scs-operation\s+([\s\S]*?)-->/u)?.[1];
  if (!block) return null;

  const values = Object.fromEntries(
    block
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        return separator < 1
          ? ['', '']
          : [line.slice(0, separator), line.slice(separator + 1).trim()];
      })
  );
  if (!values.operationId || !values.resourceType || !values.resourceId) {
    return null;
  }

  return {
    operationId: values.operationId,
    resourceType: values.resourceType,
    resourceId: values.resourceId,
  };
}

export class PullRequestGateway {
  constructor(
    private readonly client: GithubClient,
    private readonly repository: RepositoryCoordinates
  ) {}

  async findOpen(
    predicate: (pullRequest: GithubPullRequest) => boolean
  ): Promise<GithubPullRequest | null> {
    for (let page = 1; page <= MAX_PULL_REQUEST_PAGES; page += 1) {
      const response = await this.client.pulls.list({
        ...this.repository,
        state: 'open',
        per_page: PAGE_SIZE,
        page,
        sort: 'updated',
        direction: 'desc',
      });
      const match = response.data.find(predicate);
      if (match) return match;
      if (response.data.length < PAGE_SIZE) return null;
    }
    return null;
  }

  async create(input: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<GithubPullRequest> {
    const response = await this.client.pulls.create({
      ...this.repository,
      ...input,
    });
    return response.data;
  }

  async updateBody(pullNumber: number, body: string): Promise<void> {
    await this.client.pulls.update({
      ...this.repository,
      pull_number: pullNumber,
      body,
    });
  }

  async merge(pullNumber: number): Promise<boolean> {
    const response = await this.client.pulls.merge({
      ...this.repository,
      pull_number: pullNumber,
      merge_method: 'squash',
    });
    return response.data.merged;
  }
}
