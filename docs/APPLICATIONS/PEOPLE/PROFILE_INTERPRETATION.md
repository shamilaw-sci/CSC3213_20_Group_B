---
title: People profile interpretation
description: How staff and student fields become labelled profile sections, how directory context differs from academics, and how project roles are shown.
---

# People profile interpretation

People is responsible for presenting schema fields without changing their
meaning. It must not infer a department, honours programme, status, or project
role from nearby fields.

## Student semantics

| Concept                  | Source and presentation rule                                          |
| ------------------------ | --------------------------------------------------------------------- |
| directory programme      | manifest membership confirmed by the batch's student list             |
| student role             | alumni, postgraduate, honours undergraduate, or general undergraduate |
| programme                | labelled postgraduate programme, otherwise honours programme          |
| subjects                 | each subject code rendered with its own label                         |
| academic department/unit | rendered from their dedicated schema fields                           |
| level and SLQF level     | separately labelled when present                                      |

Directory context determines breadcrumbs and collection membership. It does
not overwrite the profile's academic department, unit, subjects, or programme.
The Overview and Academic tabs should therefore avoid presenting the same value
as an unexplained duplicate badge.

For students, a postgraduate programme takes presentation precedence over an
honours programme when both fields are present. Subjects remain a separate
list; a subject is not a replacement for the programme or department. Staff
rank, staff type, academic support position, and non-academic position likewise
use explicit mappings rather than formatted guesses where the schema has a
defined label set.

## Profile and project loading

Profile records and by-person project summaries load concurrently. The project
tab failing does not hide an otherwise valid person. Each project displays the
role published for that project; the application must not collapse multiple
roles into a single global title such as supervisor or contributor.

If no public person record loads but the Projects index contains entries for
the username, the route renders a project-only profile. It identifies the
username, explains that no public directory profile is available, and lists
roles beside their respective projects. If neither source provides a usable
identity, the page shows the person-not-found state.

External project cards use normal anchors to the configured Projects origin.
Social, publication, and profile links opened in a new tab include
`noopener noreferrer`. Profile tab controls and cards must preserve keyboard
focus, explicit active state, and semantic labels described in
[UI quality assurance](../../UI_QUALITY_ASSURANCE.md).
