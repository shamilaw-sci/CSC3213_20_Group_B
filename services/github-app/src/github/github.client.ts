import type { Octokit } from '@octokit/rest';

import type { GithubClient } from '@/github/github.types';

export function createGithubClient(octokit: Octokit): GithubClient {
  return {
    repos: {
      get: async (input) => {
        const response = await octokit.repos.get({
          owner: input.owner,
          repo: input.repo,
        });
        return { data: { default_branch: response.data.default_branch } };
      },
    },
    git: {
      getRef: async (input) => {
        const response = await octokit.git.getRef({
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
        });
        return { data: { object: { sha: response.data.object.sha } } };
      },
      createRef: async (input) => {
        const response = await octokit.git.createRef({
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
          sha: input.sha,
        });
        return { data: response.data };
      },
      deleteRef: async (input) => {
        const response = await octokit.git.deleteRef({
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
        });
        return { data: response.data };
      },
      getCommit: async (input) => {
        const response = await octokit.git.getCommit({
          owner: input.owner,
          repo: input.repo,
          commit_sha: input.commit_sha,
        });
        return { data: { tree: { sha: response.data.tree.sha } } };
      },
      createBlob: async (input) => {
        const response = await octokit.git.createBlob({
          owner: input.owner,
          repo: input.repo,
          content: input.content,
          encoding: input.encoding,
        });
        return { data: { sha: response.data.sha } };
      },
      createTree: async (input) => {
        const response = await octokit.git.createTree({
          owner: input.owner,
          repo: input.repo,
          base_tree: input.base_tree,
          tree: input.tree.map((entry) => ({ ...entry })),
        });
        return { data: { sha: response.data.sha } };
      },
      createCommit: async (input) => {
        const response = await octokit.git.createCommit({
          owner: input.owner,
          repo: input.repo,
          message: input.message,
          tree: input.tree,
          parents: input.parents,
        });
        return { data: { sha: response.data.sha } };
      },
      updateRef: async (input) => {
        const response = await octokit.git.updateRef({
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
          sha: input.sha,
          force: input.force,
        });
        return { data: { object: { sha: response.data.object.sha } } };
      },
      getTree: async (input) => {
        const response = await octokit.git.getTree({
          owner: input.owner,
          repo: input.repo,
          tree_sha: input.tree_sha,
          recursive: input.recursive,
        });
        return {
          data: {
            sha: response.data.sha,
            truncated: response.data.truncated,
            tree: response.data.tree,
          },
        };
      },
      getBlob: async (input) => {
        const response = await octokit.git.getBlob({
          owner: input.owner,
          repo: input.repo,
          file_sha: input.file_sha,
        });
        return {
          data: {
            content: response.data.content,
            encoding: response.data.encoding,
          },
        };
      },
    },
    pulls: {
      list: async (input) => {
        const response = await octokit.pulls.list({
          owner: input.owner,
          repo: input.repo,
          state: input.state,
          per_page: input.per_page,
          page: input.page,
          sort: input.sort,
          direction: input.direction,
        });
        return {
          data: response.data.map((pull) => ({
            number: pull.number,
            html_url: pull.html_url,
            body: pull.body,
            head: { ref: pull.head.ref, sha: pull.head.sha },
          })),
        };
      },
      create: async (input) => {
        const response = await octokit.pulls.create({
          owner: input.owner,
          repo: input.repo,
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
        });
        return {
          data: {
            number: response.data.number,
            html_url: response.data.html_url,
            body: response.data.body,
            head: {
              ref: response.data.head.ref,
              sha: response.data.head.sha,
            },
          },
        };
      },
      update: async (input) => {
        const response = await octokit.pulls.update({
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pull_number,
          body: input.body,
        });
        return { data: response.data };
      },
      merge: async (input) => {
        const response = await octokit.pulls.merge({
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pull_number,
          merge_method: input.merge_method,
        });
        return { data: { merged: response.data.merged } };
      },
    },
  };
}
