# Migration Source State

Recorded on 2026-10-17 before product files were imported. All source
repositories are read-only migration inputs. Product files must be obtained
from the recorded Git objects, not from the source working directories.

| Destination           | Source repository        | Full source commit                         | Working tree                  |
| --------------------- | ------------------------ | ------------------------------------------ | ----------------------------- |
| `apps/web`            | `scs.pdn.ac.lk`          | `7de460eda9813266bdfbde1a803d95032b164c95` | Clean                         |
| `apps/portal`         | `portal.scs.pdn.ac.lk`   | `eca1474b7c28535a223bd96a631b83481c91df9f` | Dirty; excluded from baseline |
| `apps/people`         | `people.scs.pdn.ac.lk`   | `fdd3f9edfac553033c89d08eb0419f850ca5aff6` | Dirty; excluded from baseline |
| `apps/projects`       | `projects.scs.pdn.ac.lk` | `3e905bd8873fceb95f3cc2ac8a4c43f1f34ea840` | Clean                         |
| `services/api`        | `api.scs.pdn.ac.lk`      | `0f5c03e3f57e5f44059d7b41f8b63cf5022f2d36` | Clean                         |
| `services/mailer`     | `mailer.scs.pdn.ac.lk`   | `7043928c8cf1510a081739201dc69f1d19949bc7` | Clean                         |
| `services/github-app` | `scs-portal-github-app`  | `5a3b82472af63a664a5011bde52f4135ffb8aa45` | Clean                         |

## Excluded Portal Working-Tree Paths

- `src/components/custom/project-management-page/ProjectManagementPage.tsx`

## Excluded People Working-Tree Paths

- `src/app/sitemap.ts`
- `src/app/students/computer-science/[batch]/loading.tsx`
- `src/app/students/computer-science/[batch]/page.tsx`
- `src/app/students/computer-science/loading.tsx`
- `src/app/students/computer-science/page.tsx`
- `src/app/students/data-science/[batch]/loading.tsx`
- `src/app/students/data-science/[batch]/page.tsx`
- `src/app/students/data-science/loading.tsx`
- `src/app/students/data-science/page.tsx`
- `src/app/students/statistics/[batch]/loading.tsx`
- `src/app/students/statistics/[batch]/page.tsx`
- `src/app/students/statistics/loading.tsx`
- `src/app/students/statistics/page.tsx`
- `src/app/students/[subject]/**`
- `src/components/custom/people/SubjectCardGrid.tsx`
- `src/config/subjects.ts`
- `src/lib/data/people-data.ts`
- `src/views/home/Home.tsx`
- `src/views/students/StudentsPage.tsx`

These paths are recorded only to prove exclusion. Their contents are not part
of the baseline migration and remain available solely in the untouched source
working trees for later review.
