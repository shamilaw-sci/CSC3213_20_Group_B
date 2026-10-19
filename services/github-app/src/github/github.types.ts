export interface RepositoryCoordinates {
  owner: string;
  repo: string;
}

export interface GithubPullRequest {
  number: number;
  html_url: string;
  body: string | null;
  head: { ref: string; sha?: string };
}

export interface GithubClient {
  repos: {
    get(input: RepositoryCoordinates): Promise<{
      data: { default_branch: string };
    }>;
  };
  git: {
    getRef(
      input: RepositoryCoordinates & { ref: string }
    ): Promise<{ data: { object: { sha: string } } }>;
    createRef(
      input: RepositoryCoordinates & { ref: string; sha: string }
    ): Promise<{ data: unknown }>;
    deleteRef(
      input: RepositoryCoordinates & { ref: string }
    ): Promise<{ data: unknown }>;
    getCommit(
      input: RepositoryCoordinates & { commit_sha: string }
    ): Promise<{ data: { tree: { sha: string } } }>;
    createBlob(
      input: RepositoryCoordinates & {
        content: string;
        encoding: 'utf-8';
      }
    ): Promise<{ data: { sha: string } }>;
    createTree(
      input: RepositoryCoordinates & {
        base_tree: string;
        tree: Array<{
          path: string;
          mode: '100644';
          type: 'blob';
          sha: string | null;
        }>;
      }
    ): Promise<{ data: { sha: string } }>;
    createCommit(
      input: RepositoryCoordinates & {
        message: string;
        tree: string;
        parents: string[];
      }
    ): Promise<{ data: { sha: string } }>;
    updateRef(
      input: RepositoryCoordinates & {
        ref: string;
        sha: string;
        force: false;
      }
    ): Promise<{ data: { object: { sha: string } } }>;
    getTree(
      input: RepositoryCoordinates & {
        tree_sha: string;
        recursive: 'true';
      }
    ): Promise<{
      data: {
        sha: string;
        truncated?: boolean;
        tree: Array<{
          path?: string;
          type?: string;
          sha?: string | null;
        }>;
      };
    }>;
    getBlob(input: RepositoryCoordinates & { file_sha: string }): Promise<{
      data: { content: string; encoding: string };
    }>;
  };
  pulls: {
    list(
      input: RepositoryCoordinates & {
        state: 'open';
        per_page: number;
        page: number;
        sort: 'updated';
        direction: 'desc';
      }
    ): Promise<{ data: GithubPullRequest[] }>;
    create(
      input: RepositoryCoordinates & {
        title: string;
        body: string;
        head: string;
        base: string;
      }
    ): Promise<{ data: GithubPullRequest }>;
    update(
      input: RepositoryCoordinates & { pull_number: number; body: string }
    ): Promise<{ data: unknown }>;
    merge(
      input: RepositoryCoordinates & {
        pull_number: number;
        merge_method: 'squash';
      }
    ): Promise<{ data: { merged: boolean } }>;
  };
}

export interface PullRequestOperationMetadata {
  operationId: string;
  resourceType: string;
  resourceId: string;
}
