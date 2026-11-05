---
title: AI agent skills
description: Restore, use, and maintain shared project-local skills for AI coding agents.
---

# AI agent skills

The repository uses [skills.sh](https://skills.sh) to provide reusable development guidance for AI coding agents. Each skill contains a `SKILL.md` file and optional supporting resources that agents can load for relevant tasks.

Skills complement repository instructions and technical documentation. They are not runtime dependencies and do not affect deployed applications.

## Shared skills policy

Skills belong to the repository, not to individual agents.

- `skills-lock.json` records the approved skills and their sources.
- `.agents/skills/` is the shared project-local installation directory.
- Use project-level skills only. Do not install global or user-level skills.
- Do not create separate skill collections for OpenCode, Codex, Cursor, Claude Code, or other agents.
- New skills, updates, and removals require maintainer review.

The common directory is ignored by Git and restored from the committed lockfile. Compatible agents can discover skills from this location without separate installations.

Agent discovery varies by tool. Some agents may require additional configuration to access the common directory. Preserve one authoritative skill collection rather than duplicating its contents.

Skills cannot override `AGENTS.md`, the [AI usage policy](AI_POLICY.md), or repository security requirements. A skill provides guidance, not permission to access secrets, perform destructive operations, or bypass review.

## Getting started

Run all commands from the repository root using the Bun version specified in `.bun-version`. Use `bunx` for Skills CLI commands.

### Restore approved skills

After cloning the repository, restore the skills recorded in `skills-lock.json`:

```bash
bunx skills experimental_install
bunx skills list
```

The restore command installs supported locked skills into `.agents/skills/` without creating agent-specific integrations.

To preview or refresh the local installation:

```bash
bunx skills experimental_install --dry-run
bunx skills experimental_install --force
```

The restore command is experimental, and its behavior may change. Verify that the installed paths remain inside the project.

### Use skills

Compatible agents discover and load relevant skills according to their descriptions. You can also request one explicitly:

> Use the `next-dev-loop` skill to verify this route.

Use the approved skills when relevant, but verify their instructions against the current codebase and repository policies.

If an agent cannot find a restored skill, confirm that it supports `.agents/skills/`, inspect the installed paths, and restart the agent session.

## Discover skills

Search for additional skills using:

```bash
bunx skills find <query>
```

List available skills from a source without installing them:

```bash
bunx skills add <owner/repo> --list
```

You can also browse [skills.sh](https://skills.sh) and upstream project repositories.

Prefer official, actively maintained, agent-neutral skills relevant to the technologies used in this monorepo, including Bun, Turborepo, Next.js, Cloudflare Workers, Hono, Better Auth, Prisma, and shared UI components.

**Discovery does not imply approval.** Contributors may propose useful skills, but must not add unreviewed skills to the repository's approved collection.

Avoid skills that duplicate existing guidance or depend unnecessarily on features of a single coding agent.

## Maintain skills

Maintainers manage the approved skill collection through reviewed repository changes. Run all commands from the repository root.

### Add a skill

```bash
bunx skills add <owner/repo>
```

During installation, select only the reviewed skills, choose the Universal (`.agents/skills/`) destination, and keep the installation at Project scope.

Do not select global or additional agent-specific destinations. If the CLI automatically selects an agent-specific target, use a regular terminal and review the generated files before proceeding.

### Check and update skills

```bash
bunx skills check -p
bunx skills update -p
```

The check command reports available updates without installing them. Updates must be reviewed before their changes are committed.

After an approved update, restore and verify the local collection:

```bash
bunx skills experimental_install --force
bunx skills list
```

Review the lockfile diff and any changed skill instructions. Do not apply updates blindly.

### Remove a skill

```bash
bunx skills remove <skill-name>
```

Confirm that only the intended skill was removed and that no unrelated lockfile entries or files changed.

## Review and security

Before approving a new skill or significant update, maintainers should assess:

- **Relevance:** Does it support a real repository workflow not already covered?
- **Source:** Is the upstream repository authentic, trustworthy, and maintained?
- **Quality:** Are its instructions accurate, current, and consistent with project conventions?
- **Compatibility:** Can it be used across compatible coding agents?
- **Security:** Does it request unnecessary credentials, permissions, network access, or destructive operations?

Read the complete `SKILL.md` whenever practical. Inspect referenced files, scripts, dependencies, external commands, and instructions before approval.

Check available results from [skills.sh security audits](https://skills.sh/audits) and other trusted assessments. Popularity and automated risk scores are useful signals, but do not establish that a skill is safe.

### Ongoing maintenance

Periodically review approved skills for:

- Deprecated, archived, abandoned, renamed, or relocated sources.
- Changes in repository ownership or maintainers.
- Replacements or newer official alternatives.
- Security advisories, warnings, or increased risk scores.
- Updates introducing unexpected scripts, permissions, or dependencies.
- Conflicts with existing skills, repository policies, or current framework behavior.

When a source moves or a skill is deprecated, verify the replacement before updating its lockfile entry. Remove compromised or unsupported skills through a reviewed change.

Do not silently migrate skills to new sources or trust an update solely because its source was previously approved.

### Pull request review

When changing the approved skill collection:

1. Explain the need and evaluate existing alternatives.
2. Review the source, instructions, maintenance status, and security.
3. Install only into the shared project-local collection.
4. Inspect generated files and the `skills-lock.json` diff.
5. Verify skill discovery in relevant compatible agents.
6. Record the source, rationale, and known limitations.
7. Obtain maintainer approval before merging.

Do not introduce automatic skill installation, updates, or security monitoring without an approved repository policy.

## Lockfile and reproducibility

`skills-lock.json` records the approved skill selection, source paths, and content hashes. Keep it under version control so contributors can restore the same intended collection.

The lockfile does not vendor external skill content, guarantee upstream availability, install additional dependencies, or configure every agent. The Skills CLI is also not pinned as a project dependency, so command behavior may change between releases.

Avoid unrelated or manual lockfile edits. Review unexpected source, path, hash, or selection changes before committing.

After changing the lockfile, verify the restored collection:

```bash
bunx skills experimental_install --force
bunx skills list --json
```

If restoration fails because an upstream source or its content hash changed, investigate the difference and update the lockfile intentionally. Do not bypass integrity checks without review.

## Troubleshooting

| Problem                     | First check                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| No skills listed            | Run the restore command from the repository root.                  |
| Agent cannot find a skill   | Verify support for `.agents/skills/` and restart the session.      |
| Skill content is outdated   | Review the lockfile and restore with `--force`.                    |
| Agent-specific files appear | Remove unintended copies or links; retain the common installation. |
| Source moved or disappeared | Verify the upstream status and propose a reviewed replacement.     |
| Skill conflicts with policy | Follow repository policy and report the conflict.                  |

For CLI behavior and supported installation options, consult the [official Skills CLI reference](https://skills.sh/docs/cli).
