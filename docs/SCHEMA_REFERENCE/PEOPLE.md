---
title: People schemas
description: Public schemas for identities, profile records, students, staff variants, social links, and search projections.
---

# People schemas

```mermaid
flowchart TD
  Person --> Student
  Person --> TeachingStaff[Academic teaching staff]
  Person --> SupportStaff[Academic support staff]
  Person --> NonAcademicStaff[Non-academic staff]
  TeachingStaff --> StaffUnion[Staff union]
  SupportStaff --> StaffUnion
  NonAcademicStaff --> StaffUnion
  Student --> Placement
  Student --> Programme
  Person --> SearchProjection
```

## Identity, profiles, and search

| Schema                        | Responsibility                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| `AcademicUsernameSchema`      | Normalized institutional username.                                  |
| `SNumberSchema`               | Canonical undergraduate or special-programme registration number.   |
| `PersonSchema`                | Common name, title, contact, and profile image fields.              |
| `PeopleSearchEntryTypeSchema` | Student or staff search-result kind.                                |
| `PeopleSearchEntrySchema`     | Search projection with identity, route, label, and keywords.        |
| `PeopleSearchIndexSchema`     | Complete array of people search entries.                            |
| `SocialIconSchema`            | Built-in icon identifier or validated external icon URL.            |
| `SocialLinksSchema`           | Normalized social-profile collection with platform detection rules. |

Social links are available on student and all staff profile types. They have
named slots for common social and academic platforms,
including ORCID, Google Scholar, ResearchGate, and Academia.edu. The `urls`
object holds one primary profile per known platform. `profiles` holds up to two
additional profiles for each platform, for a total of three. Known URLs entered
as custom links are recognized and promoted without the supplied name or icon.
`otherPlatforms` holds at most ten custom links, each with a name, complete URL,
and optional library or URL icon. Known profiles do not use custom-link slots.

## Staff

| Schema                          | Responsibility                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `AcademicRankSchema`            | Teaching-staff academic rank.                                                         |
| `AcademicTeachingStaffSchema`   | Teaching profile with department or unit, research, publications, courses, and links. |
| `AcademicSupportPositionSchema` | Supported academic-support designation.                                               |
| `AcademicSupportStaffSchema`    | Support profile with designation and department or unit.                              |
| `NonAcademicPositionSchema`     | Supported non-academic designation.                                                   |
| `NonAcademicStaffSchema`        | Non-academic profile with designation and department or unit.                         |
| `StaffSchema`                   | Discriminated union of all three staff profile variants.                              |

## Students and directory configuration

| Schema                                      | Responsibility                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `StudentTypeSchema`                         | Undergraduate or postgraduate student kind.                                  |
| `StudentTrackSchema`                        | General or honours undergraduate track.                                      |
| `StudentLevelSchema`                        | Undergraduate level from 1000 through 4000.                                  |
| `StudentStatusSchema`                       | Current-student or alumni status.                                            |
| `PostgraduateProgrammeSchema`               | Supported postgraduate qualification route.                                  |
| `SlqfLevelSchema`                           | Supported Sri Lanka Qualifications Framework level.                          |
| `StudentStreamSchema`                       | Canonical public directory slug, such as `computer-science`.                 |
| `StudentPlacementSchema`                    | Batch, track, and level placement rule.                                      |
| `StudentPlacementListSchema`                | Placement rule collection.                                                   |
| `AlumniBatchSchema`                         | Alumni batch and its included tracks.                                        |
| `AlumniBatchListSchema`                     | Alumni-batch rule collection.                                                |
| `PostgraduateProgrammeDefinitionSchema`     | Programme label and framework level.                                         |
| `PostgraduateProgrammeDefinitionListSchema` | Postgraduate programme definitions.                                          |
| `StudentStreamDefinitionSchema`             | Directory label, path, and visibility for a stream.                          |
| `StudentStreamDefinitionListSchema`         | Student-stream definition collection.                                        |
| `StudentSchema`                             | Person-based student profile with programme-specific cross-field validation. |

Honours programme is required only for honours undergraduates. Special-degree
subjects are restricted to honours students at the applicable levels; the
schema is the authority for these rules, not UI inference.

## Public avatars

| Schema                               | Responsibility                                                    |
| ------------------------------------ | ----------------------------------------------------------------- |
| `PublicAvatarSchema`                 | Owner identity, published image URL, and optional upload quota.   |
| `PublicAvatarQuotaSchema`            | Hourly attempt limit, usage, reset time, and availability.        |
| `PublicAvatarUploadResultSchema`     | Published image metadata, moderation result, and refreshed quota. |
| `PublicAvatarDeleteResultSchema`     | Removal outcome and refreshed quota.                              |
| `PublicAvatarErrorSchema`            | Structured avatar error with optional quota and moderation data.  |
| `PublicAvatarModerationSchema`       | Moderation status, stable code, message, and check outcomes.      |
| `PublicAvatarModerationStatusSchema` | Approved, rejected, review-required, or unavailable status.       |
| `PublicAvatarModerationCodeSchema`   | Stable moderation outcome code.                                   |
| `PublicAvatarCheckSchema`            | One safety or portrait check and its outcome.                     |
| `PublicAvatarCheckIdSchema`          | Safety or portrait check identifier.                              |
| `PublicAvatarCheckStatusSchema`      | Passed, failed, needs-review, or not-checked outcome.             |

Public avatar contracts describe the API-only picture shown in the People
directory. They are separate from private account pictures and public profile
pull requests.
