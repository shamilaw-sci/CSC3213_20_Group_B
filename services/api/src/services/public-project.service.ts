import { type EntityRevision, ProjectSchema, type Project } from '@scs/schemas';

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
import { verifySessionJwt } from '@/services/auth.service';
import {
  mutationControl,
  submitMutationOperation,
} from '@/services/mutation-operation.service';
import type { Env } from '@/types/env';

type ProjectPrStatus =
  | 'none'
  | 'open'
  | 'merged'
  | 'closed'
  | 'checks_pending'
  | 'checks_failed'
  | 'auto_merge_queued';

interface PublicProjectPr {
  status: ProjectPrStatus;
  number?: number;
  url?: string;
  branch?: string;
  headSha?: EntityRevision;
  revision?: EntityRevision;
  canEdit: boolean;
  updatedAt?: string;
  targetProjectFile?: string;
  targetAggregateFile?: string;
  targetManifestFile?: string;
  draftProject?: Record<string, unknown> | null;
}

interface PublicProjectUserContext {
  email: string;
  role: AppRole;
  isSuperAdmin: boolean;
}

interface PublicProjectSchemaResponse {
  canSubmitOwnedProjects: boolean;
  canSubmitAnyProject: boolean;
  identity: {
    email: string;
    username: string;
    sNumber: string | null;
  };
  lockedFields: string[];
  note: string;
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

async function offeringExists(env: Env, offeringId: string): Promise<boolean> {
  const response = await fetch(
    dataPublicUrl(env, '/academic/v2/offerings.json')
  );
  if (!response.ok) return false;

  const value = await response.json().catch(() => []);
  if (!Array.isArray(value)) return false;

  return value.some(
    (record) =>
      isRecord(record) &&
      typeof record.id === 'string' &&
      record.id === offeringId
  );
}

async function validateCourseProjectOfferingReference(
  env: Env,
  project: Record<string, unknown>
): Promise<string | null> {
  if (project.projectType !== 'COURSE_PROJECT') return null;

  const courseOffering = project.courseOffering;
  const offeringId =
    isRecord(courseOffering) && typeof courseOffering.id === 'string'
      ? courseOffering.id
      : null;

  if (!offeringId) {
    return 'courseOffering.id is required for course projects';
  }

  if (!(await offeringExists(env, offeringId))) {
    return 'courseOffering.id must reference an existing course offering';
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
  const verifyResponse = await verifySessionJwt(req, env);
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
    lockedFields: ['slug'],
    note: 'Submit project JSON matching @scs/schemas ProjectSchema. Non-admin users must be listed in project.people by email, username, or sNumber.',
  };
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

export async function listPublicProjects(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return Response.redirect(
      dataPublicUrl(
        env,
        `/projects/v2/by-person/${encodeURIComponent(usernameFromEmail(user.email))}.json`
      ),
      302
    );
  }

  return Response.redirect(
    dataPublicUrl(env, '/projects/v2/projects.json'),
    302
  );
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

  if (parseResult.data.slug !== slug) {
    return createJsonErrorResponse(
      'Project slug must match the URL slug',
      403,
      origin
    );
  }

  const courseOfferingError = await validateCourseProjectOfferingReference(
    env,
    project as Record<string, unknown>
  );
  if (courseOfferingError) {
    return createJsonErrorResponse(courseOfferingError, 400, origin);
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
  if (req.headers.get('Prefer')?.includes('respond-async')) {
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
