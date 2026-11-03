import {
  CourseOfferingSchema,
  CourseSchema,
  ProjectSchema,
  ProjectIndexSchema,
  type Project,
  type PublicProjectPr,
  type PublicProjectSchemaResponse,
  projectSlugBaseFromTitle,
} from '@scs/schemas';

import { callGithubApp } from '@/clients/github-app.client';
import {
  createJsonErrorResponse,
  createJsonResponse,
  createTextErrorResponse,
  getRequestOrigin,
} from '@/http/responses';
import {
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

interface PublicProjectUserContext {
  email: string;
  role: AppRole;
  isSuperAdmin: boolean;
}

function usernameFromEmail(email: string): string {
  return email.split('@')[0].toLowerCase();
}

function sNumberFromEmail(email: string): string | null {
  const username = usernameFromEmail(email);
  return /^s\d{2}(sp)?\d{3}$/i.test(username) ? username.toUpperCase() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseProjectSummaries(
  value: unknown
): Array<Record<string, unknown> & { slug: string }> | null {
  if (!Array.isArray(value)) return null;
  const entries = value.filter(
    (entry): entry is Record<string, unknown> & { slug: string } =>
      isRecord(entry) &&
      typeof entry.slug === 'string' &&
      typeof entry.id === 'string' &&
      typeof entry.title === 'string' &&
      typeof entry.shortDescription === 'string'
  );
  return entries.length === value.length ? entries : null;
}

function slugFromProjectPath(req: Request): string | null {
  const pathname = new URL(req.url).pathname;
  const prefix = '/api/projects/v2/projects/';
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const [encodedSlug] = rest.split('/');
  if (!encodedSlug) return null;

  try {
    const slug = decodeURIComponent(encodedSlug).toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

function dataPublicUrl(env: Env, path: string): string {
  return new URL(path, env.DATA_PUBLIC_BASE_URL).toString();
}

async function fetchPublicJson(
  env: Env,
  path: string
): Promise<{ status: number; value: unknown }> {
  const response = await fetch(dataPublicUrl(env, path), {
    cache: 'no-store',
  });

  if (response.status === 404) {
    return { status: 404, value: null };
  }

  if (!response.ok) {
    throw new Error(`Public data request failed for ${path}`);
  }

  return { status: response.status, value: await response.json() };
}

async function validateCourseProjectReferences(
  env: Env,
  project: Record<string, unknown>
): Promise<string | null> {
  if (project.projectType !== 'COURSE_PROJECT') return null;

  const course = project.course;
  const courseId =
    isRecord(course) && typeof course.courseId === 'string'
      ? course.courseId
      : null;
  if (!courseId) return 'course.courseId is required for course projects';

  const coursesResponse = await fetch(
    dataPublicUrl(env, '/academic/v2/courses.json')
  );
  const courses = coursesResponse.ok
    ? await coursesResponse.json().catch(() => null)
    : null;
  if (
    !Array.isArray(courses) ||
    !courses.some((record) => {
      const parsed = CourseSchema.safeParse(record);
      return parsed.success && parsed.data.id === courseId;
    })
  ) {
    return 'course.courseId must reference an existing course';
  }

  const courseOffering = project.courseOffering;
  const offeringId =
    isRecord(courseOffering) && typeof courseOffering.id === 'string'
      ? courseOffering.id
      : null;
  if (!offeringId) return null;

  const offeringsResponse = await fetch(
    dataPublicUrl(env, '/academic/v2/offerings.json')
  );
  const offerings = offeringsResponse.ok
    ? await offeringsResponse.json().catch(() => null)
    : null;
  if (
    !Array.isArray(offerings) ||
    !offerings.some((record) => {
      const parsed = CourseOfferingSchema.safeParse(record);
      return (
        parsed.success &&
        parsed.data.id === offeringId &&
        parsed.data.courseId === courseId
      );
    })
  ) {
    return 'courseOffering.id must reference an offering of the selected course';
  }

  return null;
}

async function verifiedUser(
  req: Request,
  env: Env
): Promise<
  | ({
      ok: true;
    } & PublicProjectUserContext)
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

export function targetPathsForProject(slug: string): {
  projectPath: string;
  aggregatePath: 'public/projects/v2/projects.json';
  manifestPath: 'public/projects/v2/manifest.json';
} {
  return {
    projectPath: `public/projects/v2/projects/${slug}.json`,
    aggregatePath: 'public/projects/v2/projects.json',
    manifestPath: 'public/projects/v2/manifest.json',
  };
}

const USER_PROJECT_TYPES = new Set([
  'COURSE_PROJECT',
  'STUDENT_INNOVATION',
  'OPEN_SOURCE',
  'DATASET',
  'PUBLICATION_ARTIFACT',
  'HACKATHON',
  'OTHER',
]);

export function canUserSubmitProjectType(
  user: Pick<PublicProjectUserContext, 'isSuperAdmin'>,
  projectType: Project['projectType']
): boolean {
  return user.isSuperAdmin || USER_PROJECT_TYPES.has(projectType);
}

export function canUserEditProject(
  user: Pick<PublicProjectUserContext, 'email' | 'isSuperAdmin'>,
  project: Project
): boolean {
  if (user.isSuperAdmin) return true;

  const email = user.email.toLowerCase();
  const username = usernameFromEmail(email);
  const sNumber = sNumberFromEmail(email)?.toLowerCase() ?? null;

  return project.people.some((person) => {
    const personEmail = person.email?.toLowerCase();
    const personUsername = person.username?.toLowerCase();
    const personSNumber = person.sNumber?.toLowerCase();

    return (
      personEmail === email ||
      personUsername === username ||
      (sNumber !== null && personSNumber === sNumber)
    );
  });
}

function schemaDetailsForUser(
  user: PublicProjectUserContext
): PublicProjectSchemaResponse {
  return {
    canSubmitOwnedProjects: true,
    canSubmitAnyProject: user.isSuperAdmin,
    identity: {
      email: user.email,
      username: usernameFromEmail(user.email),
      sNumber: sNumberFromEmail(user.email),
    },
    lockedFields: user.isSuperAdmin ? [] : ['id', 'slug'],
    note: 'Submit project JSON matching @scs/schemas ProjectSchema. Non-admin users must be listed in project.people by email, username, or sNumber.',
  };
}

function projectIndexUrl(project: Project): string | null {
  const source = project.source;
  if (source.kind === 'MANUAL') return null;
  if (
    !/^[a-z\d][a-z\d._-]*$/i.test(source.repositoryOwner) ||
    !/^[a-z\d][a-z\d._-]*$/i.test(source.repositoryName)
  )
    return null;
  if (
    source.kind === 'TEMPLATE_INDEX_JSON' &&
    source.metadataPath !== '.docs/index.json'
  )
    return null;
  const expected = `https://api.github.com/repos/${source.repositoryOwner}/${source.repositoryName}/contents/.docs/index.json`;
  if (
    source.kind === 'TEMPLATE_INDEX_JSON' &&
    source.indexUrl &&
    source.indexUrl !== expected
  )
    return null;
  return expected;
}

export async function previewPublicProjectSource(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;
  const slug = slugFromProjectPath(req);
  if (!slug)
    return createJsonErrorResponse('Invalid project slug', 400, origin);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }
  const parsed = ProjectSchema.safeParse(isRecord(body) ? body.project : null);
  if (!parsed.success)
    return createJsonErrorResponse('Invalid project draft', 400, origin);
  if (parsed.data.slug !== slug && !user.isSuperAdmin)
    return createJsonErrorResponse(
      'Project slug must match the URL slug',
      403,
      origin
    );
  if (!canUserEditProject(user, parsed.data))
    return createJsonErrorResponse(
      'Project editor must be a listed project person or super admin',
      403,
      origin
    );
  const indexUrl = projectIndexUrl(parsed.data);
  if (!indexUrl)
    return createJsonErrorResponse(
      'Add a public GitHub repository URL first',
      400,
      origin
    );

  try {
    const response = await fetch(indexUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      return createJsonErrorResponse(
        `Repository index request failed (${response.status})`,
        502,
        origin
      );
    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      typeof payload.content !== 'string' ||
      payload.content.length > 45000
    ) {
      return createJsonErrorResponse(
        'Repository index is invalid or too large',
        422,
        origin
      );
    }
    const bytes = Uint8Array.from(
      atob(payload.content.replace(/\s/g, '')),
      (char) => char.charCodeAt(0)
    );
    const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const index = ProjectIndexSchema.safeParse(raw);
    if (!index.success)
      return createJsonResponse(
        {
          error: 'Repository index is invalid',
          issues: index.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        422,
        origin
      );
    const metadata = index.data;
    const project = ProjectSchema.safeParse({
      ...parsed.data,
      ...metadata,
      links: {
        ...parsed.data.links,
        ...(isRecord(metadata.links) ? metadata.links : {}),
      },
      media: {
        ...parsed.data.media,
        ...(isRecord(metadata.media) ? metadata.media : {}),
      },
      dates: {
        ...parsed.data.dates,
        ...(isRecord(metadata.dates) ? metadata.dates : {}),
      },
      ...(parsed.data.course && isRecord(metadata.course)
        ? { course: { ...parsed.data.course, ...metadata.course } }
        : {}),
      id: parsed.data.id,
      slug: parsed.data.slug,
    });
    if (!project.success)
      return createJsonErrorResponse(
        'Repository index does not produce a valid project',
        422,
        origin
      );
    const changedFields = Object.keys(project.data).filter(
      (key) =>
        JSON.stringify(project.data[key as keyof Project]) !==
        JSON.stringify(parsed.data[key as keyof Project])
    );
    return createJsonResponse(
      { indexUrl, project: project.data, changedFields },
      200,
      origin
    );
  } catch {
    return createJsonErrorResponse(
      'Repository index unavailable or invalid',
      502,
      origin
    );
  }
}

export async function getPublicProject(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const slug = slugFromProjectPath(req);
  if (!slug) {
    return createJsonErrorResponse('Invalid project slug', 400, origin);
  }

  let projectValue: unknown;
  try {
    const result = await fetchPublicJson(
      env,
      `/projects/v2/projects/${slug}.json`
    );
    if (result.status === 404) {
      return createJsonErrorResponse('Project not found', 404, origin);
    }
    projectValue = result.value;
  } catch {
    return createJsonErrorResponse('Project data unavailable', 502, origin);
  }

  const parsed = ProjectSchema.safeParse(projectValue);
  if (!parsed.success) {
    return createJsonErrorResponse('Project data is invalid', 502, origin);
  }

  if (!canUserEditProject(user, parsed.data)) {
    return createJsonErrorResponse(
      'Project is not available for this user',
      403,
      origin
    );
  }

  return createJsonResponse(parsed.data, 200, origin);
}

export async function listPublicProjectsPage(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  try {
    const path = user.isSuperAdmin
      ? '/projects/v2/projects.json'
      : `/projects/v2/by-person/${encodeURIComponent(usernameFromEmail(user.email))}.json`;
    const result = await fetchPublicJson(env, path);
    if (result.status === 404) {
      return createJsonResponse(
        {
          version: 1,
          items: [],
          page: { nextCursor: null, hasMore: false, total: 0 },
        },
        200,
        origin
      );
    }
    const items = user.isSuperAdmin
      ? ProjectSchema.array().safeParse(result.value)
      : { success: true as const, data: parseProjectSummaries(result.value) };
    if (!items.success || !items.data) {
      return createJsonErrorResponse('Project data is invalid', 502, origin);
    }
    const page = paginateByKey({
      items: items.data,
      key: (project) => project.slug,
      scope: 'public-projects',
      request: parsePaginationRequest(new URL(req.url)),
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
    console.error('Error fetching project page:', error);
    return createJsonErrorResponse('Project data unavailable', 502, origin);
  }
}

export async function getPublicProjectSchema(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const slug = slugFromProjectPath(req);
  if (!slug) {
    return createJsonErrorResponse('Invalid project slug', 400, origin);
  }

  return createJsonResponse(schemaDetailsForUser(user), 200, origin);
}

export async function getPublicProjectPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const slug = slugFromProjectPath(req);
  if (!slug) {
    return createJsonErrorResponse('Invalid project slug', 400, origin);
  }

  const response = await callGithubApp<PublicProjectPr>(
    env,
    origin,
    `/projects/public-project/pr?slug=${encodeURIComponent(slug)}`
  );
  if (!response.ok) return response.response;

  if (!user.isSuperAdmin) {
    const draft = response.value.draftProject;
    const draftParse = ProjectSchema.safeParse(draft);
    const projectToCheck = draftParse.success ? draftParse.data : null;

    if (projectToCheck && !canUserEditProject(user, projectToCheck)) {
      return createJsonErrorResponse(
        'Project is not available for this user',
        403,
        origin
      );
    }

    if (!projectToCheck) {
      try {
        const result = await fetchPublicJson(
          env,
          `/projects/v2/projects/${slug}.json`
        );
        const parsed = ProjectSchema.safeParse(result.value);
        if (parsed.success && !canUserEditProject(user, parsed.data)) {
          return createJsonErrorResponse(
            'Project is not available for this user',
            403,
            origin
          );
        }
      } catch {
        return createJsonErrorResponse('Project data unavailable', 502, origin);
      }
    }
  }

  return createJsonResponse(response.value, 200, origin);
}

export async function upsertPublicProjectPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const slug = slugFromProjectPath(req);
  if (!slug) {
    return createJsonErrorResponse('Invalid project slug', 400, origin);
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

  const project = body.project;
  const parseResult = ProjectSchema.safeParse(project);
  if (!parseResult.success) {
    return createJsonResponse(
      {
        error: 'Project validation failed',
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      origin
    );
  }

  if (parseResult.data.slug !== slug && !user.isSuperAdmin) {
    return createJsonErrorResponse(
      'Project slug must match the URL slug',
      403,
      origin
    );
  }

  if (!user.isSuperAdmin) {
    try {
      const existing = await fetchPublicJson(
        env,
        `/projects/v2/projects/${slug}.json`
      );
      const existingProject = ProjectSchema.safeParse(existing.value);
      if (existing.status !== 404 && !existingProject.success) {
        return createJsonErrorResponse('Project data is invalid', 502, origin);
      }
      if (
        existingProject.success &&
        !canUserEditProject(user, existingProject.data)
      ) {
        return createJsonErrorResponse(
          'Project is not available for this user',
          403,
          origin
        );
      }
      if (
        existingProject.success &&
        existingProject.data.id !== parseResult.data.id
      ) {
        return createJsonErrorResponse(
          'Only admins can change a project ID',
          403,
          origin
        );
      }
      if (
        existing.status === 404 &&
        (parseResult.data.id !== slug ||
          !new RegExp(
            `^${projectSlugBaseFromTitle(parseResult.data.title)}-[a-f0-9]{6}$`
          ).test(slug))
      ) {
        return createJsonErrorResponse(
          'New project ID and slug must be generated from its title',
          403,
          origin
        );
      }
      if (existingProject.success) {
        const draft = await callGithubApp<PublicProjectPr>(
          env,
          origin,
          `/projects/public-project/pr?slug=${encodeURIComponent(slug)}`
        );
        if (!draft.ok) return draft.response;
        const currentDraft = ProjectSchema.safeParse(draft.value.draftProject);
        if (
          currentDraft.success &&
          (currentDraft.data.id !== parseResult.data.id ||
            currentDraft.data.slug !== parseResult.data.slug)
        ) {
          return createJsonErrorResponse(
            'Only admins can change project ID or slug',
            403,
            origin
          );
        }
      }
    } catch {
      return createJsonErrorResponse('Project data unavailable', 502, origin);
    }
  }

  const courseReferenceError = await validateCourseProjectReferences(
    env,
    project as Record<string, unknown>
  );
  if (courseReferenceError) {
    return createJsonErrorResponse(courseReferenceError, 400, origin);
  }

  if (!canUserSubmitProjectType(user, parseResult.data.projectType)) {
    return createJsonErrorResponse(
      'Only super admins can submit this project type',
      403,
      origin
    );
  }

  if (!canUserEditProject(user, parseResult.data)) {
    return createJsonErrorResponse(
      'Project editor must be a listed project person or super admin',
      403,
      origin
    );
  }

  const paths = targetPathsForProject(slug);
  const control = mutationControl(body.control);
  const mutationRequest = {
    slug,
    updatedBy: user.email,
    updatedByType: user.isSuperAdmin ? ('admin' as const) : ('owner' as const),
    expectedHeadSha: body.expectedHeadSha,
    expectedRevision: control.expectedRevision,
    projectPath: paths.projectPath,
    aggregatePath: paths.aggregatePath,
    manifestPath: paths.manifestPath,
    project: parseResult.data,
  };
  if (
    req.headers.get('Prefer')?.includes('respond-async') ||
    parseResult.data.slug !== slug
  ) {
    return submitMutationOperation({
      env,
      origin,
      path: '/projects/public-project/operations',
      actorEmail: user.email,
      control,
      envelope: { action: 'upsert', request: mutationRequest },
    });
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: PublicProjectPr;
  }>(env, origin, '/projects/public-project/pr', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mutationRequest),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function deletePublicProjectPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return createJsonErrorResponse(
      'Only super admins can remove projects from the registry',
      403,
      origin
    );
  }

  const slug = slugFromProjectPath(req);
  if (!slug) {
    return createJsonErrorResponse('Invalid project slug', 400, origin);
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const paths = targetPathsForProject(slug);
  const control = mutationControl(isRecord(body) ? body.control : undefined);
  const mutationRequest = {
    slug,
    updatedBy: user.email,
    updatedByType: 'admin' as const,
    expectedHeadSha: isRecord(body) ? body.expectedHeadSha : undefined,
    expectedRevision: control.expectedRevision,
    projectPath: paths.projectPath,
    aggregatePath: paths.aggregatePath,
    manifestPath: paths.manifestPath,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitMutationOperation({
      env,
      origin,
      path: '/projects/public-project/operations',
      actorEmail: user.email,
      control,
      envelope: { action: 'delete', request: mutationRequest },
    });
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: PublicProjectPr;
  }>(env, origin, '/projects/public-project/pr', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mutationRequest),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}
