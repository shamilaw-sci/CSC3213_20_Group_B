import {
  classifyGithubError,
  RepositoryConflictError,
} from '@/github/github.errors';
import type {
  GithubClient,
  RepositoryCoordinates,
} from '@/github/github.types';

interface AtomicFileChange {
  path: string;
  content: string | null;
}

interface AtomicCommitInput {
  repository: RepositoryCoordinates;
  ref: string;
  expectedParentSha: string;
  message: string;
  changes: AtomicFileChange[];
}

export interface AtomicCommitResult {
  commitSha: string;
  parentSha: string;
  treeSha: string;
  changedFileShas: ReadonlyMap<string, string | null>;
}

/**
 * Writes every file through one Git tree, then advances the ref with a
 * non-forced compare-and-swap. Do not replace this with per-file content API
 * calls: partial commits and concurrent overwrites would become possible.
 */
export async function createAtomicCommit(
  client: GithubClient,
  input: AtomicCommitInput
): Promise<AtomicCommitResult> {
  if (input.changes.length === 0) {
    throw new Error('An atomic commit requires at least one file change');
  }
  const paths = new Set(input.changes.map((change) => change.path));
  if (paths.size !== input.changes.length) {
    throw new Error('An atomic commit cannot contain duplicate paths');
  }

  const currentRef = await client.git.getRef({
    ...input.repository,
    ref: input.ref,
  });
  const currentSha = currentRef.data.object.sha;
  if (currentSha !== input.expectedParentSha) {
    throw new RepositoryConflictError(input.expectedParentSha, currentSha);
  }

  const parent = await client.git.getCommit({
    ...input.repository,
    commit_sha: input.expectedParentSha,
  });
  const tree = await Promise.all(
    input.changes.map(async (change) => {
      const sha =
        change.content === null
          ? null
          : (
              await client.git.createBlob({
                ...input.repository,
                content: change.content,
                encoding: 'utf-8',
              })
            ).data.sha;
      return {
        path: change.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha,
      };
    })
  );
  const changedFileShas = new Map(
    tree.map((entry) => [entry.path, entry.sha] as const)
  );
  const nextTree = await client.git.createTree({
    ...input.repository,
    base_tree: parent.data.tree.sha,
    tree,
  });
  const commit = await client.git.createCommit({
    ...input.repository,
    message: input.message,
    tree: nextTree.data.sha,
    parents: [input.expectedParentSha],
  });

  try {
    await client.git.updateRef({
      ...input.repository,
      ref: input.ref,
      sha: commit.data.sha,
      force: false,
    });
  } catch (error) {
    if (classifyGithubError(error).category !== 'compare_conflict') throw error;
    const latest = await client.git.getRef({
      ...input.repository,
      ref: input.ref,
    });
    throw new RepositoryConflictError(
      input.expectedParentSha,
      latest.data.object.sha
    );
  }

  return {
    commitSha: commit.data.sha,
    parentSha: input.expectedParentSha,
    treeSha: nextTree.data.sha,
    changedFileShas,
  };
}
