import { describe, expect, test } from 'bun:test';
import { Buffer } from 'node:buffer';

import { RepositoryGateway } from '@/github/repository.gateway';
import type { GithubClient } from '@/github/github.types';

describe('GitHub repository gateway', () => {
  test('reads requested files from one recursive tree snapshot', async () => {
    const calls: string[] = [];
    const client = {
      git: {
        getTree: async () => {
          calls.push('getTree');
          return {
            data: {
              sha: 'tree-sha',
              truncated: false,
              tree: [
                { path: 'one.json', type: 'blob', sha: 'blob-one' },
                { path: 'nested/two.json', type: 'blob', sha: 'blob-two' },
              ],
            },
          };
        },
        getBlob: async ({ file_sha }: { file_sha: string }) => {
          calls.push(`getBlob:${file_sha}`);
          return {
            data: {
              content: Buffer.from(file_sha).toString('base64'),
              encoding: 'base64',
            },
          };
        },
      },
    } as unknown as GithubClient;
    const gateway = new RepositoryGateway(client, {
      owner: 'scs',
      repo: 'config',
    });

    const snapshot = await gateway.readSnapshot('commit-sha', [
      'one.json',
      'nested/two.json',
      'missing.json',
    ]);

    expect(snapshot.treeSha).toBe('tree-sha');
    expect(snapshot.files.get('one.json')).toBe('blob-one');
    expect(snapshot.files.get('nested/two.json')).toBe('blob-two');
    expect(snapshot.files.get('missing.json')).toBeNull();
    expect(snapshot.revisions).toEqual(
      new Map([
        ['one.json', 'blob-one'],
        ['nested/two.json', 'blob-two'],
        ['missing.json', null],
      ])
    );
    expect(calls).toEqual(['getTree', 'getBlob:blob-one', 'getBlob:blob-two']);
  });

  test('rejects truncated trees instead of returning an incomplete snapshot', async () => {
    const client = {
      git: {
        getTree: async () => ({
          data: { sha: 'tree-sha', truncated: true, tree: [] },
        }),
      },
    } as unknown as GithubClient;
    const gateway = new RepositoryGateway(client, {
      owner: 'scs',
      repo: 'config',
    });

    expect(gateway.readSnapshot('commit-sha', ['one.json'])).rejects.toThrow(
      'truncated'
    );
  });
});
