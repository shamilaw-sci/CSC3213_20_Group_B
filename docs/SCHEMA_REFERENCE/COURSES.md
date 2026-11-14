---
title: Course schemas
description: Public schemas for courses, offerings, staff assignments, and their canonical identifiers.
---

# Course schemas

```mermaid
flowchart LR
  CourseCode --> Course
  Department --> Course
  Course --> Offering
  AcademicYear --> Offering
  StaffAssignment --> Offering
```

| Schema                   | Responsibility                                                            |
| ------------------------ | ------------------------------------------------------------------------- |
| `CourseCodeSchema`       | Normalized department-style course code.                                  |
| `CourseIdSchema`         | Stable kebab-case course record identifier.                               |
| `CourseSchema`           | Course identity, codes, title, credits, GPA status, and departments.      |
| `CourseOfferingIdSchema` | Stable kebab-case offering identifier.                                    |
| `CourseStaffSchema`      | Academic username and teaching role assignment.                           |
| `CourseOfferingSchema`   | Course, academic year, semester, staff, and departments for one offering. |

Course records are stable catalog entries. Offerings add time and staffing
context without duplicating the course definition. A course can exist without
an offering. Its primary code is editable in the course catalog; changing it
adds the new code to the catalog's codes while previous codes remain available
as alternate codes.

`credits` is a whole number from 0 through 10. Set `nonGpa: true` for a course
that does not count toward GPA; an omitted flag means it counts toward GPA.
Credit value and GPA status are independent, so a zero-credit course is not
automatically non GPA.
