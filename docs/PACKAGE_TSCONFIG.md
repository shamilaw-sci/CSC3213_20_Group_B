---
title: TypeScript configuration package
description: Shared compiler presets, intended consumers, extension rules, and verification for packages/tsconfig.
---

# TypeScript configuration package

`packages/tsconfig` (`@scs/tsconfig`) centralizes compiler policy. Exported
presets cover base TypeScript, libraries, React libraries, Next.js, tooling,
Cloudflare Workers, and Bun services.

Every workspace extends the closest preset and adds only local inclusions,
exclusions, path aliases, generated-file locations, or runtime-specific types.
Do not copy strictness, module-resolution, or JSX policy into each workspace.
Production and test configurations may differ so runner globals and fixtures do
not leak into production compilation.

When changing a preset, enumerate all consumers and run their typechecks. A
compiler option can change emitted code, module resolution, editor behavior, or
test discovery across the repository even when this configuration-only package
has no script of its own.
