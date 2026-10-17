# Runtime Selection

## Use Bun Runtime by Default

Use the default Bun runtime for new routes and pages. Only use Edge runtime if the project already uses it or there's a specific requirement.

```tsx
// Good: Default - no runtime config needed (uses Bun)
export default function Page() { ... }

// Caution: Only if already used in project or specifically required
export const runtime = 'edge'
```

## When to Use Each

### Bun Runtime (Default)

- Full Bun API support
- File system access (`fs`)
- Full `crypto` support
- Database connections
- Most bun packages work

### Edge Runtime

- Only for specific edge-location latency requirements
- Limited API (no `fs`, limited `crypto`)
- Smaller cold start
- Geographic distribution needs

## Detection

**Before adding `runtime = 'edge'`**, check:

1. Does the project already use Edge runtime?
2. Is there a specific latency requirement?
3. Are all dependencies Edge-compatible?

If unsure, use Bun runtime.
