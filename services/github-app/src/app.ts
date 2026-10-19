import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { handleUpdateRepositoryPermission } from '@/controllers/repository-permission.controller';
import {
  handleCancelOperation,
  handleGetOperation,
} from '@/controllers/operation.controller';
import {
  handleGetPublicProfile,
  handleGetPublicProfilePrStatus,
  handleDiscardPublicProfilePr,
  handleUpsertPublicProfilePr,
} from '@/controllers/public-profile.controller';
import {
  handleDeletePublicProjectPr,
  handleGetPublicProject,
  handleGetPublicProjectPrStatus,
  handleListPublicProjects,
  handleUpsertPublicProjectPr,
} from '@/controllers/public-project.controller';
import {
  handleDeletePublicCourseOfferingPr,
  handleDeletePublicCoursePr,
  handleGetPublicCourse,
  handleGetPublicCourseOffering,
  handleGetPublicCourseOfferingPrStatus,
  handleGetPublicCoursePrStatus,
  handleListPublicCourseOfferings,
  handleListPublicCourses,
  handleUpsertPublicCourseOfferingPr,
  handleUpsertPublicCoursePr,
} from '@/controllers/public-course.controller';
import {
  handleGetUserAccessConfig,
  handleUpdateProxySettings,
} from '@/controllers/user-access.controller';
import {
  handleDiscardStudentPlacementPrs,
  handleGetStudentPlacementPrStatus,
  handleUpsertStudentPlacementPr,
} from '@/controllers/student-placement.controller';
import { auth } from '@/middleware/auth';
import type { GithubAppEnv } from '@/types/env';

const app = new Hono<{ Bindings: GithubAppEnv }>();

app.use(logger());
app.use(auth);

app.get('/', (c) => c.json({ message: 'GitHub App is running!' }));
app.get('/operations/:operationId', async (c) =>
  handleGetOperation(c.req.raw, c.env, c.req.param('operationId'))
);
app.delete('/operations/:operationId', async (c) =>
  handleCancelOperation(c.req.raw, c.env, c.req.param('operationId'))
);

app.get('/user/access-config', async (c) =>
  handleGetUserAccessConfig(c.req.raw)
);
app.post('/user/proxy-settings', async (c) =>
  handleUpdateProxySettings(c.req.raw)
);
app.post('/user/repository-permission', async (c) =>
  handleUpdateRepositoryPermission(c.req.raw)
);
app.get('/people/public-profile', async (c) =>
  handleGetPublicProfile(c.req.raw)
);
app.get('/people/public-profile/pr', async (c) =>
  handleGetPublicProfilePrStatus(c.req.raw)
);
app.put('/people/public-profile/pr', async (c) =>
  handleUpsertPublicProfilePr(c.req.raw)
);
app.delete('/people/public-profile/pr', async (c) =>
  handleDiscardPublicProfilePr(c.req.raw)
);
app.get('/people/student-placement/pr', async () =>
  handleGetStudentPlacementPrStatus()
);
app.put('/people/student-placement/pr', async (c) =>
  handleUpsertStudentPlacementPr(c.req.raw)
);
app.delete('/people/student-placement/pr', async (c) =>
  handleDiscardStudentPlacementPrs(c.req.raw)
);
app.get('/projects/public-project', async (c) =>
  handleGetPublicProject(c.req.raw)
);
app.get('/projects/public-projects', async () => handleListPublicProjects());
app.get('/projects/public-project/pr', async (c) =>
  handleGetPublicProjectPrStatus(c.req.raw)
);
app.put('/projects/public-project/pr', async (c) =>
  handleUpsertPublicProjectPr(c.req.raw)
);
app.delete('/projects/public-project/pr', async (c) =>
  handleDeletePublicProjectPr(c.req.raw)
);
app.get('/academic/public-courses', async () => handleListPublicCourses());
app.get('/academic/public-course', async (c) =>
  handleGetPublicCourse(c.req.raw)
);
app.get('/academic/public-course/pr', async (c) =>
  handleGetPublicCoursePrStatus(c.req.raw)
);
app.put('/academic/public-course/pr', async (c) =>
  handleUpsertPublicCoursePr(c.req.raw)
);
app.delete('/academic/public-course/pr', async (c) =>
  handleDeletePublicCoursePr(c.req.raw)
);
app.get('/academic/public-course-offerings', async () =>
  handleListPublicCourseOfferings()
);
app.get('/academic/public-course-offering', async (c) =>
  handleGetPublicCourseOffering(c.req.raw)
);
app.get('/academic/public-course-offering/pr', async (c) =>
  handleGetPublicCourseOfferingPrStatus(c.req.raw)
);
app.put('/academic/public-course-offering/pr', async (c) =>
  handleUpsertPublicCourseOfferingPr(c.req.raw)
);
app.delete('/academic/public-course-offering/pr', async (c) =>
  handleDeletePublicCourseOfferingPr(c.req.raw)
);

export default app;
