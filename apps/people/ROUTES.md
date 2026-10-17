# Route Contract

This app publishes a small, canonical people directory. Keep new navigation,
sitemaps, and links aligned with these paths. Index pages should point to the
nearest useful collection path rather than flattening everyone back to a generic
index.

## Canonical Routes

- `/`
- `/people/[identity]`
- `/staff`
- `/staff/academic`
- `/staff/academic-support`
- `/staff/non-academic`
- `/students`
- `/students/computer-science`
- `/students/computer-science/[batch]`
- `/students/data-science`
- `/students/data-science/[batch]`
- `/students/statistics`
- `/students/statistics/[batch]`

`[identity]` is a lower-case staff username or student registration number.

`[batch]` accepts either `21` or `s21`; pages normalize it to the manifest batch
id format such as `s21`.

## Student Subjects

The static student subjects are defined in `src/config/subjects.ts`:

- `computer-science`
- `data-science`
- `statistics`

These are subjects within the Department of Statistics & Computer Science, not
separate departments.

## Alumni Batches

There is no separate alumni route. Alumni batches use the same subject batch URL
as current students, for example `/students/computer-science/17`.

Whether a batch is rendered as current students or alumni is decided by
`manifest.batches[].defaultCategory`.

Subject index pages must show current and alumni batches as separate groups.
Sitemaps should include subject roots and every subject batch route, including
alumni batches.

## Removed Legacy Paths

Do not reintroduce these path shapes:

- `/students/alumini`
- `/students/alumini/[...slug]`
- `/students/alumni`
- `/students/alumni/[subject]`
- `/students/alumni/[subject]/[batch]`
- `/students/[subject]/batch/[year]`
- `/student/[id]`
- `/staff/academic/[username]`
- `/staff/academic-support/[username]`
- `/staff/non-academic/[id]`
