import { describe, expect, test } from 'bun:test';

import { createAtomicCommit } from '@/github/atomic-commit';
import { RepositoryConflictError } from '@/github/github.errors';
import type { GithubClient } from '@/github/github.types';

function createClient(refSha = 'base-commit') {
  const calls: string[] = [];
  let currentRefSha = refSha;
  const client = {
    git: {
      getRef: async () => {
        calls.push('getRef');
        return { data: { object: { sha: currentRefSha } } };
      },
      getCommit: async () => {
        calls.push('getCommit');
        return { data: { tree: { sha: 'base-tree' } } };
      },
      createBlob: async ({ content }: { content: string }) => {
        calls.push(`createBlob:${content}`);
        return { data: { sha: `blob-${content}` } };
      },
      createTree: async () => {
        calls.push('createTree');
        return { data: { sha: 'next-tree' } };
      },
      createCommit: async () => {
        calls.push('createCommit');
        return { data: { sha: 'next-commit' } };
      },
      updateRef: async () => {
        calls.push('updateRef');
        return { data: { object: { sha: 'next-commit' } } };
      },
    },
    setCurrentRefSha(sha: string) {
      currentRefSha = sha;
    },
  };

  return { calls, client: client as unknown as GithubClient };
}

describe('atomic Git commit builder', () => {
  test('writes multiple file changes through one tree and one commit', async () => {
    const { calls, client } = createClient();

    const result = await createAtomicCommit(client, {
      repository: { owner: 'scs', repo: 'config' },
      ref: 'heads/change',
      expectedParentSha: 'base-commit',
      message: 'Update config atomically',
      changes: [
        { path: 'first.json', content: '{"first":true}\n' },
        { path: 'second.json', content: '{"second":true}\n' },
      ],
    });

    expect(result).toEqual({
      commitSha: 'next-commit',
      parentSha: 'base-commit',
      treeSha: 'next-tree',
    });
    expect(calls.filter((call) => call === 'createTree')).toHaveLength(1);
    expect(calls.filter((call) => call === 'createCommit')).toHaveLength(1);
    expect(calls.filter((call) => call === 'updateRef')).toHaveLength(1);
  });

  test('does not write when the expected ref has already changed', async () => {
    const { calls, client } = createClient('newer-commit');

    expect(
      createAtomicCommit(client, {
        repository: { owner: 'scs', repo: 'config' },
        ref: 'heads/change',
        expectedParentSha: 'base-commit',
        message: 'Stale update',
        changes: [{ path: 'config.json', content: '{}\n' }],
      })
    ).rejects.toEqual(
      new RepositoryConflictError('base-commit', 'newer-commit')
    );
    expect(calls).toEqual(['getRef']);
  });

  test('reports the current ref when a concurrent update wins the race', async () => {
    let refReads = 0;
    const updateInputs: Array<{ force: boolean }> = [];
    const client = {
      git: {
        getRef: async () => ({
          data: {
            object: {
              sha: refReads++ === 0 ? 'base-commit' : 'newer-commit',
            },
          },
        }),
        getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
        createBlob: async () => ({ data: { sha: 'blob-sha' } }),
        createTree: async () => ({ data: { sha: 'next-tree' } }),
        createCommit: async () => ({ data: { sha: 'next-commit' } }),
        updateRef: async (input: { force: boolean }) => {
          updateInputs.push(input);
          throw { status: 422, message: 'Update is not a fast forward' };
        },
      },
    } as unknown as GithubClient;

    expect(
      createAtomicCommit(client, {
        repository: { owner: 'scs', repo: 'config' },
        ref: 'heads/change',
        expectedParentSha: 'base-commit',
        message: 'Concurrent update',
        changes: [{ path: 'config.json', content: '{}\n' }],
      })
    ).rejects.toEqual(
      new RepositoryConflictError('base-commit', 'newer-commit')
    );
    expect(updateInputs).toHaveLength(1);
    expect(updateInputs[0]?.force).toBeFalse();
    expect(refReads).toBe(2);
  });
});
