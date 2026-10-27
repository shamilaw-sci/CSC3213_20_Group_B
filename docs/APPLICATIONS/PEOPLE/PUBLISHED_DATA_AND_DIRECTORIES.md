---
title: People published data and directories
description: Data origins, validation, cache behavior, manifests, staff groups, student batches, search, prefetching, and sitemap scope.
---

# People published data and directories

The People loader builds URLs from `NEXT_PUBLIC_PEOPLE_DATA_BASE_URL` and uses
`cache: no-store` at the network layer. A module-level promise cache deduplicates
requests for five minutes; rejected promises are removed so a later request can
retry. Prefetch helpers intentionally ignore failures because navigation still
owns the visible error state.

## Published inputs

| Input                                | Validation and missing-data behavior                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `manifest.json`                      | validates programmes and batches; missing becomes empty manifest |
| `student-streams.json`               | validates public stream definitions; missing becomes empty list  |
| `search.json`                        | validates searchable entries; missing becomes empty list         |
| `staff/*.json`                       | shared staff schemas; missing becomes empty list                 |
| `special/{programme}/{batch}.json`   | shared student schema; missing becomes empty list                |
| `users/{identity}.json`              | must parse as staff or student; missing is an error              |
| Projects `by-person/{username}.json` | validates usable project summaries; missing becomes empty list   |

Staff records use the owning schemas from `@scs/schemas`. Person profiles try
the unified staff schema before the student schema. The smaller manifest,
search, stream, and project-index contracts are validated at the loader
boundary and malformed entries either fail the collection or are omitted,
according to that contract.

## Student directory construction

The manifest is authoritative for which programmes contain which batches.
Programme pages divide batches into current and alumni groups using each
batch's `defaultCategory`. A batch route validates that the requested batch
belongs to the requested programme before loading its students, then filters
published students so an alumni directory contains alumni and a current
directory excludes them.

A registration number supplies the batch candidate, but not the final
programme. Profile breadcrumbs test the matching student lists for every
manifest programme containing that batch and choose the programme whose
published list contains that exact registration number. This avoids guessing a
student's directory from the first subject or department value on the profile.

Prefetching is bounded: likely batches are selected from current and alumni
groups, adjacent batches are prefetched around the active one, and at most 12
visible profiles are prefetched. Preserve those bounds when changing directory
navigation.

## Search and discovery

The header search index is loaded on focus or first input and reused in the
component. Matching is case-insensitive substring search over precomputed
keywords, and the panel displays at most eight results. It has explicit
loading, failure, no-result, clear, and Escape-to-close states.

The sitemap publishes stable top-level staff, student, and subject pages. It
does not enumerate profiles or dynamic batches from remote data. Canonical
username requests redirect permanently to `/people/{identity}`.
