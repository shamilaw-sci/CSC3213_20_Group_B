import {
  CourseIdSchema,
  CourseOfferingIdSchema,
  CourseOfferingSchema,
  CourseSchema,
  createPullRequestResultSchema,
  PublicAcademicPrSchema,
  type PublicCourseSchemaResponse,
} from '@scs/schemas';

import { callGithubApp } from '@/clients/github-app.client';
import {
  createJsonErrorResponse,
  createJsonResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import {
  APP_ROLE,
  getPermissionRole,
  getUserPermission,
  isSuperAdmin,
  type AppRole,
} from '@/repositories/permissions.repo';
import { verifySessionRequest } from '@/middleware/session';
import {
  InvalidPaginationCursorError,
  paginateByKey,
  parsePaginationRequest,
} from '@/pagination/cursor';
import {
  mutationControl,
  submitMutationOperation,
} from '@/services/mutation-operation.service';
import type { Env } from '@/types/env';
import { isRecord } from '@/utils/is-record';

type AcademicRegistryKind = 'course' | 'offering';
interface PublicAcademicUserContext {
  email: string;
  role: AppRole;
  isSuperAdmin: boolean;
}

function usernameFromEmail(email: string): string {
  return email.split('@')[0].toLowerCase();
}

function idFromPath(req: Request, kind: AcademicRegistryKind): string | null {
  const pathname = new URL(req.url).pathname;
  const prefix =
    kind === 'course'
      ? '/api/academic/v2/courses/'
      : '/api/academic/v2/offerings/';
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const [encodedId] = rest.split('/');
  if (!encodedId) return null;

  try {
    const id = decodeURIComponent(encodedId).toLowerCase();
    const schema = kind === 'course' ? CourseIdSchema : CourseOfferingIdSchema;
    const parsed = schema.safeParse(id);
    return parsed.success && parsed.data === id ? parsed.data : null;
  } catch {
    return null;
  }
}

function dataPublicUrl(env: Env, path: string): string {
  return new URL(path, env.DATA_PUBLIC_BASE_URL).toString();
}

async function verifiedUser(
  req: Request,
  env: Env
): Promise<
  | ({
      ok: true;
    } & PublicAcademicUserContext)
  | { ok: false; response: Response }
> {
  const origin = getRequestOrigin(req);
  const verifyResponse = await verifySessionRequest(req, env);
  if (!verifyResponse.ok) {
    return { ok: false, response: verifyResponse };
  }

  const { email }: { email?: string } = await verifyResponse.json();
  if (!email) {
    return {
      ok: false,
      response: createTextErrorResponse('Unauthorized', 401, origin),
    };
  }

  const permission = await getUserPermission(email, env);
  if (!permission || permission.blacklisted) {
    return {
      ok: false,
      response: createTextErrorResponse('Forbidden', 403, origin),
    };
  }

  return {
    ok: true,
    email,
    role: getPermissionRole(permission),
    isSuperAdmin: isSuperAdmin(permission),
  };
}

function canEditCourses(user: PublicAcademicUserContext): boolean {
  return user.isSuperAdmin || user.role === APP_ROLE.ACADEMIC;
}

function schemaDetailsForUser(
  user: PublicAcademicUserContext
): PublicCourseSchemaResponse {
  return {
    canEditCourses: canEditCourses(user),
    identity: {
      email: user.email,
      username: usernameFromEmail(user.email),
    },
    lockedFields: ['id'],
    note: 'Only academic users and super admins can submit course catalog and offering changes.',
  };
}

function targetPathsForCourse(id: string): {
  recordPath: string;
  aggregatePath: 'public/academic/v2/courses.json';
} {
  return {
    recordPath: `public/academic/v2/courses/${id}.json`,
    aggregatePath: 'public/academic/v2/courses.json',
  };
}

function targetPathsForOffering(id: string): {
  recordPath: string;
  aggregatePath: 'public/academic/v2/offerings.json';
} {
  return {
    recordPath: `public/academic/v2/offerings/${id}.json`,
    aggregatePath: 'public/academic/v2/offerings.json',
  };
}

export async function listPublicCourses(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  return Response.redirect(
    dataPublicUrl(env, '/academic/v2/courses.json'),
    302
  );
}

async function fetchRegistryPage<T>(input: {
  req: Request;
  env: Env;
  path: string;
  scope: string;
  parse: (value: unknown) => { success: true; data: T[] } | { success: false };
  key: (item: T) => string;
  label: string;
}): Promise<Response> {
  const origin = getRequestOrigin(input.req);
  try {
    const response = await fetch(dataPublicUrl(input.env, input.path), {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${input.label} registry unavailable`);
    const parsed = input.parse(await response.json());
    if (!parsed.success) {
      return createJsonErrorResponse(
        `${input.label} data is invalid`,
        502,
        origin
      );
    }
    const page = paginateByKey({
      items: parsed.data,
      key: input.key,
      scope: input.scope,
      request: parsePaginationRequest(new URL(input.req.url)),
    });
    return createJsonResponse({ version: 1, ...page }, 200, origin);
  } catch (error) {
    if (error instanceof InvalidPaginationCursorError) {
      return createJsonErrorResponse(
        'Invalid cursor or page limit',
        400,
        origin
      );
    }
    console.error(`Error fetching ${input.label.toLowerCase()} page:`, error);
    return createJsonErrorResponse(
      `${input.label} data unavailable`,
      502,
      origin
    );
  }
}

export async function listPublicCoursesPage(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;
  return fetchRegistryPage({
    req,
    env,
    path: '/academic/v2/courses.json',
    scope: 'public-courses',
    parse: (value) => CourseSchema.array().safeParse(value),
    key: (course) => course.id,
    label: 'Course',
  });
}

export async function getPublicCourse(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const id = idFromPath(req, 'course');
  if (!id) {
    return createJsonErrorResponse('Invalid course id', 400, origin);
  }

  return Response.redirect(
    dataPublicUrl(env, `/academic/v2/courses/${id}.json`),
    302
  );
}

export async function listPublicOfferings(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  return Response.redirect(
    dataPublicUrl(env, '/academic/v2/offerings.json'),
    302
  );
}

export async function listPublicOfferingsPage(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;
  return fetchRegistryPage({
    req,
    env,
    path: '/academic/v2/offerings.json',
    scope: 'public-offerings',
    parse: (value) => CourseOfferingSchema.array().safeParse(value),
    key: (offering) => offering.id,
    label: 'Offering',
  });
}

export async function getPublicOffering(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const id = idFromPath(req, 'offering');
  if (!id) {
    return createJsonErrorResponse('Invalid offering id', 400, origin);
  }

  return Response.redirect(
    dataPublicUrl(env, `/academic/v2/offerings/${id}.json`),
    302
  );
}

export async function getPublicCourseSchema(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  return createJsonResponse(schemaDetailsForUser(user), 200, origin);
}

export async function getPublicCoursePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const id = idFromPath(req, 'course');
  if (!id) {
    return createJsonErrorResponse('Invalid course id', 400, origin);
  }

  const response = await callGithubApp(
    env,
    origin,
    `/academic/public-course/pr?id=${encodeURIComponent(id)}`,
    undefined,
    { schema: PublicAcademicPrSchema }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value, 200, origin);
}

export async function getPublicOfferingPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const id = idFromPath(req, 'offering');
  if (!id) {
    return createJsonErrorResponse('Invalid offering id', 400, origin);
  }

  const response = await callGithubApp(
    env,
    origin,
    `/academic/public-course-offering/pr?id=${encodeURIComponent(id)}`,
    undefined,
    { schema: PublicAcademicPrSchema }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value, 200, origin);
}

export async function upsertPublicCoursePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!canEditCourses(user)) {
    return createJsonErrorResponse(
      'Only academic users and super admins can edit courses',
      403,
      origin
    );
  }

  const id = idFromPath(req, 'course');
  if (!id) {
    return createJsonErrorResponse('Invalid course id', 400, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!isRecord(body)) {
    return createJsonErrorResponse(
      'Request body must be an object',
      400,
      origin
    );
  }

  const parseResult = CourseSchema.safeParse(body.course);
  if (!parseResult.success) {
    return createJsonResponse(
      {
        error: 'Course validation failed',
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      origin
    );
  }

  if (parseResult.data.id !== id) {
    return createJsonErrorResponse('Course id must match URL id', 403, origin);
  }

  const paths = targetPathsForCourse(id);
  const control = mutationControl(body.control);
  const mutationRequest = {
    id,
    updatedBy: user.email,
    expectedHeadSha: body.expectedHeadSha,
    expectedRevision: control.expectedRevision,
    recordPath: paths.recordPath,
    aggregatePath: paths.aggregatePath,
    course: parseResult.data,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitMutationOperation({
      env,
      origin,
      path: '/academic/public-course/operations',
      actorEmail: user.email,
      control,
      envelope: { operation: 'course.upsert', request: mutationRequest },
    });
  }

  const response = await callGithubApp(
    env,
    origin,
    '/academic/public-course/pr',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationRequest),
    },
    { schema: createPullRequestResultSchema(PublicAcademicPrSchema) }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function upsertPublicOfferingPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!canEditCourses(user)) {
    return createJsonErrorResponse(
      'Only academic users and super admins can edit course offerings',
      403,
      origin
    );
  }

  const id = idFromPath(req, 'offering');
  if (!id) {
    return createJsonErrorResponse('Invalid offering id', 400, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!isRecord(body)) {
    return createJsonErrorResponse(
      'Request body must be an object',
      400,
      origin
    );
  }

  const parseResult = CourseOfferingSchema.safeParse(body.offering);
  if (!parseResult.success) {
    return createJsonResponse(
      {
        error: 'Course offering validation failed',
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      origin
    );
  }

  if (parseResult.data.id !== id) {
    return createJsonErrorResponse(
      'Offering id must match URL id',
      403,
      origin
    );
  }

  const paths = targetPathsForOffering(id);
  const control = mutationControl(body.control);
  const mutationRequest = {
    id,
    updatedBy: user.email,
    expectedHeadSha: body.expectedHeadSha,
    expectedRevision: control.expectedRevision,
    recordPath: paths.recordPath,
    aggregatePath: paths.aggregatePath,
    offering: parseResult.data,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitMutationOperation({
      env,
      origin,
      path: '/academic/public-course-offering/operations',
      actorEmail: user.email,
      control,
      envelope: { operation: 'offering.upsert', request: mutationRequest },
    });
  }

  const response = await callGithubApp(
    env,
    origin,
    '/academic/public-course-offering/pr',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationRequest),
    },
    { schema: createPullRequestResultSchema(PublicAcademicPrSchema) }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function deletePublicCoursePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!canEditCourses(user)) {
    return createJsonErrorResponse(
      'Only academic users and super admins can remove courses',
      403,
      origin
    );
  }

  const id = idFromPath(req, 'course');
  if (!id) {
    return createJsonErrorResponse('Invalid course id', 400, origin);
  }

  const parsedBody: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsedBody) ? parsedBody : {};
  const paths = targetPathsForCourse(id);
  const control = mutationControl(body.control);
  const mutationRequest = {
    id,
    updatedBy: user.email,
    expectedHeadSha: body.expectedHeadSha,
    expectedRevision: control.expectedRevision,
    recordPath: paths.recordPath,
    aggregatePath: paths.aggregatePath,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitMutationOperation({
      env,
      origin,
      path: '/academic/public-course/operations',
      actorEmail: user.email,
      control,
      envelope: { operation: 'course.delete', request: mutationRequest },
    });
  }

  const response = await callGithubApp(
    env,
    origin,
    '/academic/public-course/pr',
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationRequest),
    },
    { schema: createPullRequestResultSchema(PublicAcademicPrSchema) }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function deletePublicOfferingPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!canEditCourses(user)) {
    return createJsonErrorResponse(
      'Only academic users and super admins can remove course offerings',
      403,
      origin
    );
  }

  const id = idFromPath(req, 'offering');
  if (!id) {
    return createJsonErrorResponse('Invalid offering id', 400, origin);
  }

  const parsedBody: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsedBody) ? parsedBody : {};
  const paths = targetPathsForOffering(id);
  const control = mutationControl(body.control);
  const mutationRequest = {
    id,
    updatedBy: user.email,
    expectedHeadSha: body.expectedHeadSha,
    expectedRevision: control.expectedRevision,
    recordPath: paths.recordPath,
    aggregatePath: paths.aggregatePath,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitMutationOperation({
      env,
      origin,
      path: '/academic/public-course-offering/operations',
      actorEmail: user.email,
      control,
      envelope: { operation: 'offering.delete', request: mutationRequest },
    });
  }

  const response = await callGithubApp(
    env,
    origin,
    '/academic/public-course-offering/pr',
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationRequest),
    },
    { schema: createPullRequestResultSchema(PublicAcademicPrSchema) }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}
