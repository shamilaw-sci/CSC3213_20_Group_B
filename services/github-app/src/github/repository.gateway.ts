import { Buffer } from 'node:buffer';

import type {
  GithubClient,
  RepositoryCoordinates,
} from '@/github/github.types';

export interface RepositorySnapshot {
  files: Map<string, string | null>;
  revisions: Map<string, string | null>;
  treeSha: string;
}

export class RepositoryGateway {
  constructor(
    private readonly client: GithubClient,
    private readonly repository: RepositoryCoordinates
  ) {}

  async getDefaultBranch(): Promise<{ name: string; sha: string }> {
    const repository = await this.client.repos.get(this.repository);
    const name = repository.data.default_branch;
    return { name, sha: await this.getRefSha(`heads/${name}`) };
  }

  async getRefSha(ref: string): Promise<string> {
    const response = await this.client.git.getRef({
      ...this.repository,
      ref,
    });
    return response.data.object.sha;
  }

  async createBranch(branch: string, sha: string): Promise<void> {
    await this.client.git.createRef({
      ...this.repository,
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  async deleteBranch(branch: string): Promise<void> {
    await this.client.git.deleteRef({
      ...this.repository,
      ref: `heads/${branch}`,
    });
  }

  async readSnapshot(
    ref: string,
    paths: string[]
  ): Promise<RepositorySnapshot> {
    const response = await this.client.git.getTree({
      ...this.repository,
      tree_sha: ref,
      recursive: 'true',
    });
    if (response.data.truncated) {
      throw new Error(
        `GitHub returned a truncated repository tree for ${this.repository.owner}/${this.repository.repo}`
      );
    }

    const entries = new Map(
      response.data.tree.flatMap((entry) =>
        entry.type === 'blob' && entry.path && entry.sha
          ? [[entry.path, entry.sha] as const]
          : []
      )
    );
    const files = new Map<string, string | null>();
    const revisions = new Map<string, string | null>();
    await Promise.all(
      [...new Set(paths)].map(async (path) => {
        const sha = entries.get(path);
        if (!sha) {
          files.set(path, null);
          revisions.set(path, null);
          return;
        }
        revisions.set(path, sha);

        const blob = await this.client.git.getBlob({
          ...this.repository,
          file_sha: sha,
        });
        const content =
          blob.data.encoding === 'base64'
            ? Buffer.from(blob.data.content, 'base64').toString('utf8')
            : blob.data.content;
        files.set(path, content);
      })
    );

    return { files, revisions, treeSha: response.data.sha };
  }
}
