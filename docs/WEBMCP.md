---
title: Browser WebMCP
description: Browser tool registration, application capabilities, and support limits.
---

# Browser WebMCP

The five Next.js applications expose browser tools through the experimental
`document.modelContext` API. Tools run in the current tab and reuse existing
public data or signed-in sessions. They do not create an HTTP MCP server. The
current [WebMCP draft](https://webmachinelearning.github.io/webmcp/) and
[Chrome guide](https://developer.chrome.com/docs/ai/webmcp/) place the API on
`document`, not `navigator`.

## Shared package

`@scs/webmcp/react` provides `useWebMcpTool`. It handles browser feature
detection, registration, result normalization, error reporting, rerender
stability, and abort-based cleanup. It parses every invocation with its Zod
schema. Keep each discovery JSON Schema in sync with its runtime Zod schema.
The root layouts mount client tool owners across App Router navigation. The
hook returns `supported`, `registered`, and `error` for diagnostics.

Chrome Labs' [`use-webmcp-tool`](https://github.com/GoogleChromeLabs/use-webmcp-tool)
was evaluated but not installed. Its 0.3.0 implementation does not await the
Promise returned by `registerTool`, so asynchronous registration rejection is
unhandled. The shared hook awaits that Promise and reports the error. It uses
the official [`webmcp-types`](https://github.com/webmachinelearning/webmcp-types)
declarations directly.

`@scs/webmcp` provides `isWebMcpSupported`, `parseToolInput`, and
`initializeWebMcp`. The last accepts an optional async loader that installs
`document.modelContext` before tool components mount. No polyfill is loaded by
these applications. A polyfill alone does not supply a browser agent, and
installing one would need separate compatibility and security review.

Example in a client component:

```tsx
const schema = z.object({ query: z.string().min(2).max(100) }).strict();
const inputSchema = {
  type: 'object',
  properties: { query: { type: 'string' } },
  required: ['query'],
} as const;

useWebMcpTool({
  name: 'example.search',
  description:
    'Searches example content. Use when the user wants matching pages.',
  schema,
  inputSchema,
  annotations: { readOnlyHint: true },
  execute: ({ query }) => searchExistingContent(query),
});
```

## Application tools

| Application | Tools                                           | Existing capability                             |
| ----------- | ----------------------------------------------- | ----------------------------------------------- |
| Web         | `web.list_sections`, `web.open_section`         | Local navigation entries                        |
| People      | `people.search_profiles`, `people.open_profile` | Published people search index and profile route |
| Projects    | `projects.search`, `projects.inspect`           | Published projects and existing search logic    |
| Portal      | `portal.current_account`, `portal.open_account` | Better Auth session and own account route       |
| Docs        | `docs.search_guides`, `docs.open_guide`         | Generated handbook page index and routes        |

Portal tools register only after the session hook confirms sign-in. Each call
checks the session again and returns only the signed-in user's name and email,
or opens that user's own account route. Backend authorization remains
independent; registration is not an authorization grant. No tool calls private
automation routes or performs a mutation. Search results are bounded, and
navigation targets are checked against known routes or generated page indexes.
Tool execution happens in the current page context, so treat inputs and results
as agent-visible, validate input at the Zod boundary, keep results minimal, and
do not expose credentials or privileged operations through tools.
The shared hook returns validation failures and deliberate `WebMcpToolError`
messages to the agent; unexpected exceptions are reduced to a generic failure.
Use `onError` for local diagnostics and do not copy sensitive exception details
into a public tool error.

## Browser support and verification

The native API is experimental. Current Chrome guidance requires Chrome 149 or
newer with WebMCP enabled, either through the site's origin-trial enrollment or
the corresponding local Chrome flag (`chrome://flags/#enable-webmcp-testing`).
The repository does not itself enroll production origins in an origin trial;
deployment owners must verify that setup before claiming native production
availability. No other browser's native support is claimed here. Without
`document.modelContext`, the hooks leave the UI unchanged and register no tools.
When the API appears after mount, the hook polls briefly for it; registration
otherwise waits until the owning component mounts. Registration is tied to that
component's lifetime: metadata changes replace the registration, while unmount
or disabling the tool aborts it. Results settling after owner cleanup are
discarded. The React hook owns registration and cleanup;
`instrumentation-client.ts` is not a second registration path.

In a WebMCP-enabled Chrome tab, inspect `await document.modelContext.getTools()`
on each app, execute a tool in Chrome DevTools **Application > WebMCP**, and
check registration after navigation, sign-in, and sign-out. Confirm that
portal tools disappear on sign-out and that calls made with an expired session
return an error. Package tests mock `document.modelContext`; app tests mock the
hook and session. They cover registration, input validation, cleanup, and
session gating, but do not prove
native browser discovery, origin-trial configuration, interoperability with
other browsers or agents, or production security.
