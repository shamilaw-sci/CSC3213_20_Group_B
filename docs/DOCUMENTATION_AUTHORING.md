---
title: Documentation authoring
description: How humans and agents add, link, validate, and publish repository documentation from root Markdown.
---

# Documentation authoring

Root `docs/**/*.md` files are the only authored handbook source. They remain
readable in an editor and on GitHub; `apps/docs` compiles the same files into the
published Fumadocs site.

The [Docs application internals](APPLICATIONS/DOCS/INDEX.md) guide explains the
source loader, route mapping, navigation ownership, search, metadata,
agent-readable outputs, and MDX rendering boundary.

## Add or change a page

1. Use an `UPPER_SNAKE_CASE.md` filename under `docs`.
2. Add bounded YAML frontmatter with non-empty `title` and `description`.
3. Keep exactly one visible `# H1` matching the page subject.
4. Add the page exactly once to the `meta.json` in its own directory. A parent
   `meta.json` may reference a child directory that has its own `meta.json`.
5. Make the page discoverable from the root `README.md`. Section entry pages
   may link to their nested pages, so every nested page does not need another
   root-level README entry.
6. Use relative `.md` links between source pages. Links resolve from the source
   page's directory, and the site rewrites them to lowercase kebab-case
   `/docs/*` routes.
7. Run `bun run docs:check`, `bun run test:docs`, and the `@scs/docs` tests and
   build.

Mermaid fences are supported and remain readable in source. Prefer tables for
exact mappings, Mermaid for flows or ownership, and prose for details. Do not
publish credentials, private incident data, provider identifiers that are not
already public configuration, or copied third-party documentation.

The published site also derives static search, `/llms.txt`, `/llms-full.txt`,
and per-page Markdown from the same source. Page actions let readers copy or
open that Markdown and edit the owning file on GitHub. Do not maintain a second
search index or agent-only copy of the handbook.

Update documentation in the same commit as changed commands, routes,
environment variables, workflows, deployment steps, or boundaries. Remove
completed plans once their durable decisions are represented in living pages.

## Code examples

Fumadocs highlights fenced code at build time with Shiki. Use a specific
language identifier so examples receive the correct grammar and icon. Titles,
copy controls, horizontal overflow, and light/dark token colors are provided by
Fumadocs; authors should not reproduce them with HTML or JSX.

An ordinary highlighted block needs only a language:

````md
```typescript
export const enabled = true;
```
````

Add `title` when a file name, relative path, workspace, or execution context
helps the reader:

````md
```typescript title="apps/portal/src/config.ts"
export const enabled = true;
```

```json title="package.json"
{
  "private": true
}
```

```bash title="Monorepo root"
bun run docs:check
```
````

Use `lineNumbers` only when prose refers to line numbers. It accepts an
optional starting value, such as `lineNumbers=4`.

````md
```typescript title="src/config.ts" lineNumbers
const mode = 'production';
export { mode };
```
````

Fumadocs enables Shiki's comment-notation transformers. The annotation is
removed from the rendered code:

````md
```typescript
const stable = true; // [!code highlight]
const repository = 'main'; // [!code word:main]
const removed = false; // [!code --]
const added = true; // [!code ++]
```
````

Use highlights to direct attention, and diffs only when the example is
actually explaining a change.

## Platform tabs

Adjacent code fences with `tab` metadata become native Fumadocs code tabs. Put
`tab-group` on the first fence to synchronize and persist the selected shell
across matching groups. Do not create tabs when every command is identical.

````md
```powershell title="Monorepo root" tab="PowerShell" tab-group="terminal"
Set-Location scs-pdn-monorepo
bun install --frozen-lockfile
```

```bash title="Monorepo root" tab="Bash"
cd scs-pdn-monorepo
bun install --frozen-lockfile
```

```cmd title="Monorepo root" tab="Command Prompt"
cd /d scs-pdn-monorepo
bun install --frozen-lockfile
```
````

`tab` and `tab-group` are native Fumadocs metadata. Tabs retain each fence's
language, title, highlighting, and copy action. The copy action belongs to the
visible fence, so it copies only the selected shell's command.

Keep custom processing narrow. Use ordinary fences for static code, native
Fumadocs metadata for titles and tabs, Shiki annotations for highlights and
diffs, and Mermaid fences for diagrams. Write main-repository URLs explicitly;
the documentation does not switch repositories in the browser.
