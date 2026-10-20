import {
  updateMyNotificationsPreference,
  updatePermissions,
} from '@/services/permissions.service';
import { me, updateMe } from '@/services/profile.service';
import {
  deleteUserPermissions,
  getUserPermissions,
  listUsers,
  listUsersPage,
  updateUserPermissions,
} from '@/services/admin.service';
import {
  listAdminActions,
  runAdminAction,
} from '@/services/admin-actions.service';
import {
  getOrCreateUserProxy,
  listAdminProxiesPage,
  resetAdminProxyAttempts,
} from '@/services/proxy.service';
import {
  discardAdminUserPublicProfilePr,
  discardAdminStudentPlacementMetadataPrs,
  getAdminUserPublicProfile,
  getAdminUserPublicProfilePr,
  getAdminUserPublicProfileSchema,
  getAdminStudentPlacementMetadata,
  getAdminStudentPlacementMetadataPr,
  getAdminUserStudentPlacement,
  getMyPublicProfile,
  getMyPublicProfilePr,
  getMyPublicProfileSchema,
  getMyStudentPlacement,
  getProfileOperation,
  upsertAdminStudentPlacementMetadataPr,
  upsertAdminUserPublicProfilePr,
  upsertMyPublicProfilePr,
} from '@/services/public-profile.service';
import {
  deletePublicProjectPr,
  getPublicProject,
  getPublicProjectPr,
  getPublicProjectSchema,
  listPublicProjects,
  listPublicProjectsPage,
  upsertPublicProjectPr,
} from '@/services/public-project.service';
import {
  deletePublicCoursePr,
  deletePublicOfferingPr,
  getPublicCourse,
  getPublicCoursePr,
  getPublicCourseSchema,
  getPublicOffering,
  getPublicOfferingPr,
  listPublicCourses,
  listPublicCoursesPage,
  listPublicOfferings,
  listPublicOfferingsPage,
  upsertPublicCoursePr,
  upsertPublicOfferingPr,
} from '@/services/public-course.service';
import type { Env } from '@/types/env';
import {
  createMethodNotAllowedResponse,
  createNotFoundResponse,
} from '@/http/responses';

type RouteRequestHandler = (req: Request, env: Env) => Promise<Response>;

type RoutePathMatch =
  { kind: 'exact'; path: string } | { kind: 'prefix'; path: string };

type RegisteredRoute = {
  method: string;
  match: RoutePathMatch;
  handler: RouteRequestHandler;
};

const routes: RegisteredRoute[] = [
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/operations/' },
    handler: getProfileOperation,
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/operations/' },
    handler: getProfileOperation,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/user/proxy' },
    handler: getOrCreateUserProxy,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/admin/proxies/page' },
    handler: listAdminProxiesPage,
  },
  {
    method: 'POST',
    match: { kind: 'exact', path: '/user/proxy' },
    handler: getOrCreateUserProxy,
  },
  {
    method: 'POST',
    match: { kind: 'exact', path: '/api/admin/proxy/reset-attempts' },
    handler: resetAdminProxyAttempts,
  },
  { method: 'GET', match: { kind: 'exact', path: '/api/me' }, handler: me },
  {
    method: 'PATCH',
    match: { kind: 'exact', path: '/api/me' },
    handler: updateMe,
  },
  {
    method: 'PATCH',
    match: { kind: 'exact', path: '/api/me/notifications' },
    handler: updateMyNotificationsPreference,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/people/v2/me' },
    handler: getMyPublicProfile,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/people/v2/me/schema' },
    handler: getMyPublicProfileSchema,
  },
  {
    method: 'POST',
    match: { kind: 'exact', path: '/api/people/v2/me/student-placement' },
    handler: getMyStudentPlacement,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/people/v2/me/pr' },
    handler: getMyPublicProfilePr,
  },
  {
    method: 'POST',
    match: { kind: 'exact', path: '/api/people/v2/me/pr' },
    handler: upsertMyPublicProfilePr,
  },
  {
    method: 'PUT',
    match: { kind: 'exact', path: '/api/people/v2/me/pr' },
    handler: upsertMyPublicProfilePr,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/people/v2/admin/student-placement' },
    handler: getAdminStudentPlacementMetadata,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/people/v2/admin/student-placement/pr' },
    handler: getAdminStudentPlacementMetadataPr,
  },
  {
    method: 'PUT',
    match: { kind: 'exact', path: '/api/people/v2/admin/student-placement/pr' },
    handler: upsertAdminStudentPlacementMetadataPr,
  },
  {
    method: 'DELETE',
    match: { kind: 'exact', path: '/api/people/v2/admin/student-placement/pr' },
    handler: discardAdminStudentPlacementMetadataPrs,
  },
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/people/v2/admin/users/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.endsWith('/schema')) {
        return getAdminUserPublicProfileSchema(req, env);
      }
      if (pathname.endsWith('/pr')) {
        return getAdminUserPublicProfilePr(req, env);
      }
      return getAdminUserPublicProfile(req, env);
    },
  },
  {
    method: 'POST',
    match: { kind: 'prefix', path: '/api/people/v2/admin/users/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.endsWith('/student-placement')) {
        return getAdminUserStudentPlacement(req, env);
      }
      return upsertAdminUserPublicProfilePr(req, env);
    },
  },
  {
    method: 'PUT',
    match: { kind: 'prefix', path: '/api/people/v2/admin/users/' },
    handler: upsertAdminUserPublicProfilePr,
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/people/v2/admin/users/' },
    handler: discardAdminUserPublicProfilePr,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/projects/v2/projects' },
    handler: listPublicProjects,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/projects/v2/projects/page' },
    handler: listPublicProjectsPage,
  },
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/projects/v2/projects/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.endsWith('/schema')) {
        return getPublicProjectSchema(req, env);
      }
      if (pathname.endsWith('/pr')) {
        return getPublicProjectPr(req, env);
      }
      return getPublicProject(req, env);
    },
  },
  {
    method: 'POST',
    match: { kind: 'prefix', path: '/api/projects/v2/projects/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return upsertPublicProjectPr(req, env);
    },
  },
  {
    method: 'PUT',
    match: { kind: 'prefix', path: '/api/projects/v2/projects/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return upsertPublicProjectPr(req, env);
    },
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/projects/v2/projects/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return deletePublicProjectPr(req, env);
    },
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/academic/v2/courses' },
    handler: listPublicCourses,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/academic/v2/courses/page' },
    handler: listPublicCoursesPage,
  },
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/academic/v2/courses/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.endsWith('/schema')) {
        return getPublicCourseSchema(req, env);
      }
      if (pathname.endsWith('/pr')) {
        return getPublicCoursePr(req, env);
      }
      return getPublicCourse(req, env);
    },
  },
  {
    method: 'PUT',
    match: { kind: 'prefix', path: '/api/academic/v2/courses/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return upsertPublicCoursePr(req, env);
    },
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/academic/v2/courses/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return deletePublicCoursePr(req, env);
    },
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/academic/v2/offerings' },
    handler: listPublicOfferings,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/academic/v2/offerings/page' },
    handler: listPublicOfferingsPage,
  },
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/academic/v2/offerings/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.endsWith('/schema')) {
        return getPublicCourseSchema(req, env);
      }
      if (pathname.endsWith('/pr')) {
        return getPublicOfferingPr(req, env);
      }
      return getPublicOffering(req, env);
    },
  },
  {
    method: 'PUT',
    match: { kind: 'prefix', path: '/api/academic/v2/offerings/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return upsertPublicOfferingPr(req, env);
    },
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/academic/v2/offerings/' },
    handler: async (req, env) => {
      const pathname = new URL(req.url).pathname;
      if (!pathname.endsWith('/pr')) {
        return createNotFoundResponse(req.headers.get('origin') || '');
      }
      return deletePublicOfferingPr(req, env);
    },
  },
  {
    method: 'PATCH',
    match: { kind: 'exact', path: '/api/user/permissions' },
    handler: updatePermissions,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/admin/actions' },
    handler: listAdminActions,
  },
  {
    method: 'POST',
    match: { kind: 'prefix', path: '/api/admin/actions/' },
    handler: runAdminAction,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/admin/users' },
    handler: listUsers,
  },
  {
    method: 'GET',
    match: { kind: 'exact', path: '/api/admin/users/page' },
    handler: listUsersPage,
  },
  {
    method: 'GET',
    match: { kind: 'prefix', path: '/api/admin/users/' },
    handler: getUserPermissions,
  },
  {
    method: 'PATCH',
    match: { kind: 'prefix', path: '/api/admin/users/' },
    handler: updateUserPermissions,
  },
  {
    method: 'DELETE',
    match: { kind: 'prefix', path: '/api/admin/users/' },
    handler: deleteUserPermissions,
  },
];

function matchesRoutePath(pathname: string, match: RoutePathMatch): boolean {
  return match.kind === 'exact'
    ? pathname === match.path
    : pathname.startsWith(match.path);
}

export async function dispatchRoute(req: Request, env: Env): Promise<Response> {
  const pathname = new URL(req.url).pathname;

  for (const route of routes) {
    if (route.method !== req.method) continue;
    if (!matchesRoutePath(pathname, route.match)) continue;
    return route.handler(req, env);
  }

  const hasMethod = routes.some((route) =>
    matchesRoutePath(pathname, route.match)
  );
  return hasMethod
    ? createMethodNotAllowedResponse()
    : createNotFoundResponse(req.headers.get('origin') || '');
}
