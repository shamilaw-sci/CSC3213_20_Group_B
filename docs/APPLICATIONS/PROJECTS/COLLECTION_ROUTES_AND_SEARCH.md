---
title: Projects collection routes and search
description: Canonical path grammar, project types, categories, topics, search matching, pagination, metadata, and retired query state.
---

# Projects collection routes and search

Discovery state is encoded in paths so a collection can be copied, indexed, and
revisited without a query-string-only UI.

| Collection   | Canonical path                                           |
| ------------ | -------------------------------------------------------- |
| all projects | `/browse`                                                |
| project type | `/types/{fixed-type-segment}`                            |
| category     | `/categories/{canonical-category}`                       |
| topic        | `/topics/{canonical-topic}`                              |
| search       | `/search/{canonical-terms}`                              |
| later page   | append `/page/{number}` where number is greater than one |

Project type segments are an explicit exhaustive mapping from the shared
`ProjectType` enum. Category, topic, and search values are Unicode-normalized,
trimmed, lowercased, converted to hyphen-separated segments, and rejected when
empty or equivalent to `.` or `..`. Route pages reject non-canonical values and
invalid page suffixes rather than creating duplicate URLs.

Page one never carries `/page/1`. Pagination contains 12 projects per page and
clamps an in-memory requested page to the available range; server route parsing
still rejects malformed or non-canonical path syntax.

## Filtering and search

Type filters compare the exact schema enum. Category and topic filters compare
canonicalized published values. Search splits the canonical path segment into
terms and requires every term to occur in a normalized text corpus containing
the title, descriptions, type, status, academic context, course, categories,
topics, people fields, and links.

Search pages use canonical metadata but are marked `noindex, follow`. Browse,
type, category, and topic pages can be indexed. The sitemap derives populated
collections from published records and emits every required pagination path.

Old root query keys such as `q`, `category`, `topic`, `type`, and `page` are not
translated into the path model. Their presence causes a redirect to the clean
home URL while unrelated query parameters are retained. New discovery features
must define and test a canonical path grammar before adding controls.
