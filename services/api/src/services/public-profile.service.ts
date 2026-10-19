import {
  AcademicSupportStaffSchema,
  AcademicTeachingStaffSchema,
  NonAcademicStaffSchema,
  StudentPlacementSchema,
  StudentSchema,
  type AcademicSupportStaff,
  type AcademicTeachingStaff,
  type NonAcademicStaff,
  type MutationAccepted,
  type OperationStatusResponse,
  type Student,
} from '@scs/schemas';
import type { z } from 'zod';

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
import { verifySessionJwt } from '@/services/auth.service';
import type { Env } from '@/types/env';

const PROFILE_KINDS = [
  'academic',
  'academic-support',
  'non-academic',
  'student',
] as const;

const SPECIAL_STREAMS = [
  'biomedical-science',
  'botany',
  'computer-science',
  'data-science',
  'geology',
  'mathematics',
  'microbiology',
  'molecular-biology',
  'physics',
  'statistics',
  'zoology',
  'applied-science',
  'statistics-and-operations-research',
] as const;
const HONOURS_PROGRAMME_STREAMS: Record<string, SpecialStream> = {
  APPLIED_SCIENCES: 'applied-science',
  BIOMEDICAL_SCIENCE: 'biomedical-science',
  BOTANY: 'botany',
  COMPUTER_SCIENCE: 'computer-science',
  DATA_SCIENCE: 'data-science',
  GEOLOGY: 'geology',
  MATHEMATICS: 'mathematics',
  MICROBIOLOGY: 'microbiology',
  MOLECULAR_BIOLOGY_AND_BIOTECHNOLOGY: 'molecular-biology',
  PHYSICS: 'physics',
  STATISTICS: 'statistics',
  STATISTICS_AND_OPERATIONS_RESEARCH: 'statistics-and-operations-research',
  ZOOLOGY: 'zoology',
};
const STUDENT_TRACKS = ['GENERAL', 'HONOURS'] as const;
const POSTGRADUATE_PROGRAMMES = [
  'POSTGRADUATE_CERTIFICATE',
  'POSTGRADUATE_DIPLOMA',
  'MASTERS_COURSEWORK',
  'MSC',
  'MPHIL',
  'MPHIL_UPGRADE_FROM_MSC',
  'PHD',
  'PHD_UPGRADE_FROM_MSC',
  'PHD_UPGRADE_FROM_MPHIL',
] as const;
const SLQF_LEVELS = ['L7', 'L8', 'L9', 'L10', 'L11', 'L12'] as const;

type ProfileKind = (typeof PROFILE_KINDS)[number];
type SpecialStream = (typeof SPECIAL_STREAMS)[number];
type StudentTrack = (typeof STUDENT_TRACKS)[number];
type StudentLevel = NonNullable<Student['level']>;
type StudentStatus = 'CURRENT' | 'ALUMNI';
type PostgraduateProgramme = (typeof POSTGRADUATE_PROGRAMMES)[number];
type SlqfLevel = (typeof SLQF_LEVELS)[number];

type ProfileByKind = {
  academic: AcademicTeachingStaff;
  'academic-support': AcademicSupportStaff;
  'non-academic': NonAcademicStaff;
  student: Student;
};

type PublicProfile = ProfileByKind[ProfileKind];

type ProfileSchemaMap = {
  [Kind in ProfileKind]: z.ZodType<ProfileByKind[Kind]>;
};

type ProfilePrStatus =
  | 'none'
  | 'open'
  | 'merged'
  | 'closed'
  | 'checks_pending'
  | 'checks_failed'
  | 'auto_merge_queued';

interface PublicProfilePr {
  status: ProfilePrStatus;
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  currentUserFileSha?: string | null;
  revision?: string;
  canEdit: boolean;
  updatedAt?: string;
  profileKind?: ProfileKind;
  stream?: string;
  targetUserFile?: string;
  targetAggregateFiles?: string[];
  draftProfile?: Record<string, unknown> | null;
}

interface StudentPlacementPr {
  status: 'none' | 'open' | 'merged' | 'closed';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  canEdit: boolean;
  updatedAt?: string;
}

interface ProfileConcurrency {
  expectedUserFileSha?: string | null;
  expectedPrHeadSha?: string;
}

interface ProfilePatchRequest {
  profileKind: ProfileKind;
  stream?: SpecialStream;
  profile: unknown;
  concurrency?: ProfileConcurrency;
  control?: {
    idempotencyKey?: string;
    expectedRevision?: string;
  };
}

async function actorSubjectId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email.trim().toLowerCase())
  );
  return `usr_${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function submitProfileOperation(input: {
  env: Env;
  origin: string;
  actorEmail: string;
  request: Record<string, unknown>;
  control?: ProfilePatchRequest['control'];
}): Promise<Response> {
  const idempotencyKey = input.control?.idempotencyKey ?? crypto.randomUUID();
  const response = await callGithubApp<MutationAccepted>(
    input.env,
    input.origin,
    '/people/public-profile/operations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request: {
          ...input.request,
          expectedRevision: input.control?.expectedRevision,
        },
        actorSubjectId: await actorSubjectId(input.actorEmail),
        idempotencyKey,
        correlationId: crypto.randomUUID(),
      }),
    }
  );
  if (!response.ok) return response.response;
  return createJsonResponse(response.value, 202, input.origin);
}

interface StudentPlacementRequest {
  studentType?: unknown;
  studentTrack?: unknown;
  postgraduateProgramme?: unknown;
}

interface StudentPlacement {
  registrationNo: string;
  studentType: 'UNDERGRADUATE';
  studentTrack: StudentTrack;
  level: StudentLevel;
  status: StudentStatus;
  lockedFields: string[];
}

interface PostgraduatePlacement {
  registrationNo: string;
  studentType: 'POSTGRADUATE';
  postgraduateProgramme: PostgraduateProgramme;
  slqfLevel: SlqfLevel;
  status: StudentStatus;
  lockedFields: string[];
}

type StudentPlacementResponse = StudentPlacement | PostgraduatePlacement;

interface DiscardProfilePrRequest {
  prNumber: number;
  expectedHeadSha: string;
  reason?: string;
}

interface PublicProfileUserContext {
  email: string;
  role: AppRole;
  isSuperAdmin: boolean;
}

interface PublicProfileSchemaResponse {
  allowedKinds: ProfileKind[];
  specialStreams: readonly SpecialStream[];
  identity: {
    email: string;
    username: string;
  };
  lockedFields: string[];
  note: string;
}

interface StudentPlacementRecord {
  batch: string;
  studentTrack: StudentTrack;
  level: StudentLevel;
}

interface AlumniRecord {
  batch: string;
  studentTracks: StudentTrack[];
}

interface PostgraduateProgrammeRecord {
  programme: PostgraduateProgramme;
  label: string;
  slqfLevel: SlqfLevel;
}

interface StudentStreamRecord {
  stream: SpecialStream;
  label: string;
  directory?: string;
  publicDirectory: boolean;
}

const schemas = {
  academic: AcademicTeachingStaffSchema,
  'academic-support': AcademicSupportStaffSchema,
  'non-academic': NonAcademicStaffSchema,
  student: StudentSchema,
} satisfies ProfileSchemaMap;

function isProfileKind(value: unknown): value is ProfileKind {
  return (
    typeof value === 'string' && PROFILE_KINDS.includes(value as ProfileKind)
  );
}

function isSpecialStream(value: unknown): value is SpecialStream {
  return (
    typeof value === 'string' &&
    SPECIAL_STREAMS.includes(value as SpecialStream)
  );
}

function streamFromHonoursProgramme(
  profile: PublicProfile
): SpecialStream | null {
  if (!('honoursProgramme' in profile)) return null;
  const stream = HONOURS_PROGRAMME_STREAMS[profile.honoursProgramme ?? ''];
  return stream ?? null;
}

function departmentSlug(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().toLowerCase().replaceAll('_', '-');
}

function isStudentTrack(value: unknown): value is StudentTrack {
  return (
    typeof value === 'string' && STUDENT_TRACKS.includes(value as StudentTrack)
  );
}

function isPostgraduateProgramme(
  value: unknown
): value is PostgraduateProgramme {
  return (
    typeof value === 'string' &&
    POSTGRADUATE_PROGRAMMES.includes(value as PostgraduateProgramme)
  );
}

function isSlqfLevel(value: unknown): value is SlqfLevel {
  return typeof value === 'string' && SLQF_LEVELS.includes(value as SlqfLevel);
}

function usernameFromEmail(email: string): string {
  return email.split('@')[0].toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function departmentFromProfile(profile: PublicProfile): string | null {
  if (!isRecord(profile)) return null;
  const record = profile as Record<string, unknown>;
  return departmentSlug(record.department);
}

function batchFromUsername(username: string): string | null {
  const match = /^s(\d{2})(sp)?\d{3}$/i.exec(username.trim());
  return match ? `s${match[1]}` : null;
}

function batchFromRegistrationNo(registrationNo: string): string | null {
  const match = /^S(\d{2})(SP)?\d{3}$/i.exec(registrationNo.trim());
  return match ? `s${match[1]}` : null;
}

function usernameFromProfile(profile: PublicProfile): string | null {
  if ('registrationNo' in profile) {
    return profile.registrationNo.trim().toLowerCase();
  }

  if (profile.email?.includes('@')) {
    return usernameFromEmail(profile.email);
  }

  return null;
}

function allowedKindsForRole(role: AppRole): ProfileKind[] {
  switch (role) {
    case APP_ROLE.ACADEMIC:
      return ['academic'];
    case APP_ROLE.ACADEMIC_SUPPORT:
      return ['academic-support'];
    case APP_ROLE.NON_ACADEMIC:
      return ['non-academic'];
    case APP_ROLE.STUDENT:
      return ['student'];
    default:
      return [];
  }
}

function lockedFieldsForKind(profileKind: ProfileKind): string[] {
  if (profileKind === 'student') {
    return ['registrationNo', 'email', 'level', 'status', 'slqfLevel'];
  }

  return ['email', 'staffType'];
}

function schemaDetailsForUser(
  user: PublicProfileUserContext
): PublicProfileSchemaResponse {
  return {
    allowedKinds: allowedKindsForRole(user.role),
    specialStreams: SPECIAL_STREAMS,
    identity: {
      email: user.email,
      username: usernameFromEmail(user.email),
    },
    lockedFields: [
      ...new Set(allowedKindsForRole(user.role).flatMap(lockedFieldsForKind)),
    ],
    note: 'Submit profile JSON matching @scs/schemas.',
  };
}

function staffTypeForKind(
  profileKind: ProfileKind
): 'ACADEMIC_TEACHING' | 'ACADEMIC_SUPPORT' | 'NON_ACADEMIC' | null {
  if (profileKind === 'academic') return 'ACADEMIC_TEACHING';
  if (profileKind === 'academic-support') return 'ACADEMIC_SUPPORT';
  if (profileKind === 'non-academic') return 'NON_ACADEMIC';
  return null;
}

function trustedProfileForTarget(input: {
  profileKind: ProfileKind;
  profile: Record<string, unknown>;
  targetEmail: string;
  studentPlacement?: StudentPlacementResponse;
}): Record<string, unknown> {
  const username = usernameFromEmail(input.targetEmail);
  const nextProfile = { ...input.profile };
  const staffType = staffTypeForKind(input.profileKind);

  if (staffType) {
    nextProfile.email = input.targetEmail;
    nextProfile.staffType = staffType;
    return nextProfile;
  }

  nextProfile.email = input.targetEmail;
  if (/^s\d{2}(sp)?\d{3}$/i.test(username)) {
    nextProfile.registrationNo = username.toUpperCase();
  }

  if (input.studentPlacement?.studentType === 'UNDERGRADUATE') {
    nextProfile.studentType = 'UNDERGRADUATE';
    nextProfile.studentTrack = input.studentPlacement.studentTrack;
    nextProfile.level = input.studentPlacement.level;
    nextProfile.status = input.studentPlacement.status;
    delete nextProfile.postgraduateProgramme;
    delete nextProfile.slqfLevel;
  } else if (input.studentPlacement?.studentType === 'POSTGRADUATE') {
    nextProfile.studentType = 'POSTGRADUATE';
    nextProfile.postgraduateProgramme =
      input.studentPlacement.postgraduateProgramme;
    nextProfile.slqfLevel = input.studentPlacement.slqfLevel;
    nextProfile.status = input.studentPlacement.status;
    delete nextProfile.studentTrack;
    delete nextProfile.level;
  }

  return nextProfile;
}

function targetPaths(input: {
  profileKind: ProfileKind;
  stream?: SpecialStream;
  profile: PublicProfile;
  username: string;
}): { userPath: string; aggregatePaths: string[] } | null {
  const userPath = `public/people/v2/users/${input.username}.json`;

  if (input.profileKind === 'academic') {
    const aggregatePaths = ['public/people/v2/staff/academic.json'];
    const department = departmentFromProfile(input.profile);
    if (department) {
      aggregatePaths.push(`public/people/v2/staff/${department}/academic.json`);
    }
    return {
      userPath,
      aggregatePaths,
    };
  }

  if (input.profileKind === 'academic-support') {
    const aggregatePaths = ['public/people/v2/staff/academic-support.json'];
    const department = departmentFromProfile(input.profile);
    if (department) {
      aggregatePaths.push(
        `public/people/v2/staff/${department}/academic-support.json`
      );
    }
    return {
      userPath,
      aggregatePaths,
    };
  }

  if (input.profileKind === 'non-academic') {
    const aggregatePaths = ['public/people/v2/staff/non-academic.json'];
    const department = departmentFromProfile(input.profile);
    if (department) {
      aggregatePaths.push(
        `public/people/v2/staff/${department}/non-academic.json`
      );
    }
    return {
      userPath,
      aggregatePaths,
    };
  }

  const registrationNo =
    'registrationNo' in input.profile ? input.profile.registrationNo : null;
  if (!registrationNo) return null;

  const batch = batchFromRegistrationNo(registrationNo);
  if (!batch) return null;

  const aggregatePaths = [`public/people/v2/students/${batch}.json`];
  const stream = input.stream ?? streamFromHonoursProgramme(input.profile);
  if (
    'studentTrack' in input.profile &&
    input.profile.studentTrack === 'HONOURS' &&
    stream
  ) {
    aggregatePaths.push(`public/people/v2/special/${stream}/${batch}.json`);
  }

  return { userPath, aggregatePaths };
}

async function verifiedUser(
  req: Request,
  env: Env
): Promise<
  | ({
      ok: true;
    } & PublicProfileUserContext)
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

function targetEmailFromAdminPath(req: Request): string | null {
  const pathname = new URL(req.url).pathname;
  const prefix = '/api/people/v2/admin/users/';
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const [encodedEmail] = rest.split('/');
  if (!encodedEmail) return null;

  try {
    return decodeURIComponent(encodedEmail).toLowerCase();
  } catch {
    return null;
  }
}

async function verifiedAdminTarget(
  req: Request,
  env: Env
): Promise<
  | {
      ok: true;
      actor: PublicProfileUserContext;
      target: PublicProfileUserContext;
    }
  | { ok: false; response: Response }
> {
  const origin = getRequestOrigin(req);
  const actor = await verifiedUser(req, env);
  if (!actor.ok) return actor;

  if (!actor.isSuperAdmin) {
    return {
      ok: false,
      response: createJsonErrorResponse(
        'Super admin access required',
        403,
        origin
      ),
    };
  }

  const targetEmail = targetEmailFromAdminPath(req);
  if (!targetEmail) {
    return {
      ok: false,
      response: createJsonErrorResponse(
        'Target email is required',
        400,
        origin
      ),
    };
  }

  const targetPermission = await getUserPermission(targetEmail, env);
  if (!targetPermission || targetPermission.blacklisted) {
    return {
      ok: false,
      response: createJsonErrorResponse('Target user not found', 404, origin),
    };
  }

  return {
    ok: true,
    actor,
    target: {
      email: targetEmail,
      role: getPermissionRole(targetPermission),
      isSuperAdmin: isSuperAdmin(targetPermission),
    },
  };
}

function dataPublicUrl(env: Env, path: string): string {
  return new URL(path, env.DATA_PUBLIC_BASE_URL).toString();
}

async function readPublicJson(env: Env, path: string): Promise<unknown> {
  const response = await fetch(dataPublicUrl(env, path), {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }
  return response.json();
}

function parseStudentPlacements(value: unknown): StudentPlacementRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = StudentPlacementSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function parseAlumni(value: unknown): AlumniRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const { batch, studentTracks } = item;
    if (
      typeof batch !== 'string' ||
      !/^s\d{2}$/.test(batch.toLowerCase()) ||
      !Array.isArray(studentTracks)
    ) {
      return [];
    }
    const tracks = studentTracks.filter(isStudentTrack);
    if (!tracks.length) return [];
    return [
      { batch: batch.toLowerCase(), studentTracks: [...new Set(tracks)] },
    ];
  });
}

function parsePostgraduateProgrammes(
  value: unknown
): PostgraduateProgrammeRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const { programme, label, slqfLevel } = item;
    if (
      !isPostgraduateProgramme(programme) ||
      typeof label !== 'string' ||
      !label.trim() ||
      !isSlqfLevel(slqfLevel)
    ) {
      return [];
    }
    return [{ programme, label: label.trim(), slqfLevel }];
  });
}

function parseStudentStreams(value: unknown): StudentStreamRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const { stream, label, directory, publicDirectory } = item;
    if (
      !isSpecialStream(stream) ||
      typeof label !== 'string' ||
      !label.trim() ||
      (directory !== undefined &&
        (typeof directory !== 'string' || !directory.trim())) ||
      typeof publicDirectory !== 'boolean'
    ) {
      return [];
    }
    return [
      {
        stream,
        label: label.trim(),
        ...(typeof directory === 'string'
          ? { directory: directory.trim() }
          : {}),
        publicDirectory,
      },
    ];
  });
}

function hasDuplicates<T>(items: T[], keyForItem: (item: T) => string) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyForItem(item);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function hasAlumniWithoutPlacement(
  alumni: AlumniRecord[],
  placement: StudentPlacementRecord[]
) {
  const placementKeys = new Set(
    placement.map((rule) => `${rule.batch}:${rule.studentTrack}`)
  );
  return alumni.some((rule) =>
    rule.studentTracks.some(
      (track) => !placementKeys.has(`${rule.batch}:${track}`)
    )
  );
}

async function getStudentPlacementMetadata(env: Env) {
  const [placements, alumni, programmes, streams] = await Promise.all([
    readPublicJson(env, '/people/v2/student-placement.json'),
    readPublicJson(env, '/people/v2/alumni.json'),
    readPublicJson(env, '/people/v2/postgraduate-programmes.json'),
    readPublicJson(env, '/people/v2/student-streams.json'),
  ]);

  return {
    placements: parseStudentPlacements(placements),
    alumni: parseAlumni(alumni),
    programmes: parsePostgraduateProgrammes(programmes),
    streams: parseStudentStreams(streams),
  };
}

async function resolveStudentPlacement(input: {
  env: Env;
  targetEmail: string;
  request: StudentPlacementRequest;
}): Promise<
  | { ok: true; placement: StudentPlacementResponse }
  | { ok: false; message: string; status: number }
> {
  const username = usernameFromEmail(input.targetEmail);
  const batch = batchFromUsername(username);
  if (!batch) {
    return {
      ok: false,
      message: 'Student placement requires an S-number account',
      status: 400,
    };
  }

  const registrationNo = username.toUpperCase();
  const studentType =
    input.request.studentType === 'POSTGRADUATE'
      ? 'POSTGRADUATE'
      : 'UNDERGRADUATE';
  const metadata = await getStudentPlacementMetadata(input.env);

  if (studentType === 'POSTGRADUATE') {
    if (!isPostgraduateProgramme(input.request.postgraduateProgramme)) {
      return {
        ok: false,
        message: 'Postgraduate programme is required',
        status: 400,
      };
    }

    const programme = metadata.programmes.find(
      (item) => item.programme === input.request.postgraduateProgramme
    );
    if (!programme) {
      return {
        ok: false,
        message: 'Postgraduate programme is not available',
        status: 409,
      };
    }

    return {
      ok: true,
      placement: {
        registrationNo,
        studentType,
        postgraduateProgramme: programme.programme,
        slqfLevel: programme.slqfLevel,
        status: 'CURRENT',
        lockedFields: ['registrationNo', 'email', 'slqfLevel', 'status'],
      },
    };
  }

  const studentTrack = isStudentTrack(input.request.studentTrack)
    ? input.request.studentTrack
    : 'GENERAL';
  const placement = metadata.placements.find(
    (item) => item.batch === batch && item.studentTrack === studentTrack
  );
  if (!placement) {
    return {
      ok: false,
      message: 'Student placement is not available for the selected track',
      status: 409,
    };
  }

  const alumni = metadata.alumni.some(
    (item) =>
      item.batch === batch &&
      item.studentTracks.includes(placement.studentTrack)
  );

  return {
    ok: true,
    placement: {
      registrationNo,
      studentType,
      studentTrack: placement.studentTrack,
      level: placement.level,
      status: alumni ? 'ALUMNI' : 'CURRENT',
      lockedFields: ['registrationNo', 'email', 'level', 'status'],
    },
  };
}

export async function getMyPublicProfile(
  req: Request,
  env: Env
): Promise<Response> {
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const username = usernameFromEmail(user.email);
  return Response.redirect(
    dataPublicUrl(env, `/people/v2/users/${username}.json`),
    302
  );
}

export async function getAdminUserPublicProfile(
  req: Request,
  env: Env
): Promise<Response> {
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  const username = usernameFromEmail(verified.target.email);
  return Response.redirect(
    dataPublicUrl(env, `/people/v2/users/${username}.json`),
    302
  );
}

export async function getMyPublicProfileSchema(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  return createJsonResponse(schemaDetailsForUser(user), 200, origin);
}

async function readStudentPlacementRequest(
  req: Request,
  origin: string
): Promise<
  | { ok: true; value: StudentPlacementRequest }
  | { ok: false; response: Response }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: createJsonErrorResponse('Invalid JSON body', 400, origin),
    };
  }

  if (!isRecord(body)) {
    return {
      ok: false,
      response: createJsonErrorResponse(
        'Request body must be an object',
        400,
        origin
      ),
    };
  }

  return { ok: true, value: body };
}

export async function getMyStudentPlacement(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!allowedKindsForRole(user.role).includes('student')) {
    return createJsonErrorResponse('Forbidden profile kind', 403, origin);
  }

  const body = await readStudentPlacementRequest(req, origin);
  if (!body.ok) return body.response;

  try {
    const placement = await resolveStudentPlacement({
      env,
      targetEmail: user.email,
      request: body.value,
    });
    if (!placement.ok) {
      return createJsonErrorResponse(
        placement.message,
        placement.status,
        origin
      );
    }

    return createJsonResponse(placement.placement, 200, origin);
  } catch {
    return createJsonErrorResponse(
      'Unable to resolve student placement',
      502,
      origin
    );
  }
}

export async function getAdminUserPublicProfileSchema(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  return createJsonResponse(schemaDetailsForUser(verified.target), 200, origin);
}

export async function getAdminUserStudentPlacement(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  if (!allowedKindsForRole(verified.target.role).includes('student')) {
    return createJsonErrorResponse('Forbidden profile kind', 403, origin);
  }

  const body = await readStudentPlacementRequest(req, origin);
  if (!body.ok) return body.response;

  try {
    const placement = await resolveStudentPlacement({
      env,
      targetEmail: verified.target.email,
      request: body.value,
    });
    if (!placement.ok) {
      return createJsonErrorResponse(
        placement.message,
        placement.status,
        origin
      );
    }

    return createJsonResponse(placement.placement, 200, origin);
  } catch {
    return createJsonErrorResponse(
      'Unable to resolve student placement',
      502,
      origin
    );
  }
}

export async function getAdminStudentPlacementMetadata(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }

  try {
    const metadata = await getStudentPlacementMetadata(env);
    return createJsonResponse(
      {
        placement: metadata.placements,
        alumni: metadata.alumni,
        postgraduateProgrammes: metadata.programmes,
        studentStreams: metadata.streams,
      },
      200,
      origin
    );
  } catch {
    return createJsonErrorResponse(
      'Unable to load student placement metadata',
      502,
      origin
    );
  }
}

export async function getAdminStudentPlacementMetadataPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: StudentPlacementPr;
  }>(env, origin, '/people/student-placement/pr');
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function upsertAdminStudentPlacementMetadataPr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
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

  const placement = parseStudentPlacements(body.placement);
  const alumni = parseAlumni(body.alumni);
  const postgraduateProgrammes = parsePostgraduateProgrammes(
    body.postgraduateProgrammes
  );
  const studentStreams = parseStudentStreams(body.studentStreams);

  if (
    !Array.isArray(body.placement) ||
    !Array.isArray(body.alumni) ||
    !Array.isArray(body.postgraduateProgrammes) ||
    !Array.isArray(body.studentStreams) ||
    placement.length !== body.placement.length ||
    alumni.length !== body.alumni.length ||
    postgraduateProgrammes.length !== body.postgraduateProgrammes.length ||
    studentStreams.length !== body.studentStreams.length ||
    hasDuplicates(placement, (rule) => `${rule.batch}:${rule.studentTrack}`) ||
    hasDuplicates(alumni, (rule) => rule.batch) ||
    hasDuplicates(postgraduateProgrammes, (rule) => rule.programme) ||
    hasDuplicates(studentStreams, (rule) => rule.stream) ||
    hasAlumniWithoutPlacement(alumni, placement)
  ) {
    return createJsonErrorResponse(
      'Invalid student placement metadata',
      400,
      origin
    );
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: PublicProfilePr;
  }>(env, origin, '/people/student-placement/pr', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      updatedBy: user.email,
      placement,
      alumni,
      postgraduateProgrammes,
      studentStreams,
    }),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function discardAdminStudentPlacementMetadataPrs(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  if (!user.isSuperAdmin) {
    return createJsonErrorResponse('Super admin access required', 403, origin);
  }

  const response = await callGithubApp<{
    success: boolean;
    cleanup: { closed: number };
  }>(env, origin, '/people/student-placement/pr', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updatedBy: user.email }),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.cleanup, 200, origin);
}

export async function getMyPublicProfilePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  const username = usernameFromEmail(user.email);
  const response = await callGithubApp<PublicProfilePr>(
    env,
    origin,
    `/people/public-profile/pr?username=${encodeURIComponent(username)}`
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value, 200, origin);
}

export async function getAdminUserPublicProfilePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  const username = usernameFromEmail(verified.target.email);
  const response = await callGithubApp<PublicProfilePr>(
    env,
    origin,
    `/people/public-profile/pr?username=${encodeURIComponent(username)}`
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value, 200, origin);
}

export async function upsertMyPublicProfilePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return createJsonErrorResponse(
      'Request body must be an object',
      400,
      origin
    );
  }

  const patchRequest = body as ProfilePatchRequest;
  const { profileKind, stream, profile } = patchRequest;
  if (!isProfileKind(profileKind)) {
    return createJsonErrorResponse('Invalid profile kind', 400, origin);
  }

  if (
    profileKind === 'student' &&
    stream !== undefined &&
    !isSpecialStream(stream)
  ) {
    return createJsonErrorResponse('Invalid honours stream', 400, origin);
  }

  if (!allowedKindsForRole(user.role).includes(profileKind)) {
    return createJsonErrorResponse('Forbidden profile kind', 403, origin);
  }

  if (!isRecord(profile)) {
    return createJsonErrorResponse('Profile must be an object', 400, origin);
  }

  let studentPlacement: StudentPlacementResponse | undefined;
  if (profileKind === 'student') {
    try {
      const placement = await resolveStudentPlacement({
        env,
        targetEmail: user.email,
        request: profile,
      });
      if (!placement.ok) {
        return createJsonErrorResponse(
          placement.message,
          placement.status,
          origin
        );
      }
      studentPlacement = placement.placement;
    } catch {
      return createJsonErrorResponse(
        'Unable to resolve student placement',
        502,
        origin
      );
    }
  }

  const trustedProfile = trustedProfileForTarget({
    profileKind,
    profile,
    targetEmail: user.email,
    studentPlacement,
  });

  const parseResult = schemas[profileKind].safeParse(trustedProfile);
  if (!parseResult.success) {
    return createJsonResponse(
      {
        error: 'Profile validation failed',
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      origin
    );
  }
  const validatedProfile = {
    ...(parseResult.data as Record<string, unknown>),
    ...(profileKind === 'student' ? trustedProfile : {}),
  } as PublicProfile;
  const username = usernameFromProfile(validatedProfile);
  if (!username) {
    return createJsonErrorResponse(
      'Unable to derive profile username',
      400,
      origin
    );
  }

  if (!user.isSuperAdmin && username !== usernameFromEmail(user.email)) {
    return createJsonErrorResponse(
      'Profile identity must match the signed-in user',
      403,
      origin
    );
  }

  const paths = targetPaths({
    profileKind,
    stream,
    profile: validatedProfile,
    username,
  });
  if (!paths) {
    return createJsonErrorResponse(
      'Unable to derive profile data paths',
      400,
      origin
    );
  }

  const mutationRequest = {
    username,
    updatedBy: user.email,
    updatedByType: 'self' as const,
    profileKind,
    userPath: paths.userPath,
    aggregatePaths: paths.aggregatePaths,
    expectedUserFileSha: patchRequest.concurrency?.expectedUserFileSha,
    expectedPrHeadSha: patchRequest.concurrency?.expectedPrHeadSha,
    profile: validatedProfile,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitProfileOperation({
      env,
      origin,
      actorEmail: user.email,
      request: mutationRequest,
      control: patchRequest.control,
    });
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: PublicProfilePr;
  }>(env, origin, '/people/public-profile/pr', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mutationRequest),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function upsertAdminUserPublicProfilePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return createJsonErrorResponse(
      'Request body must be an object',
      400,
      origin
    );
  }

  const patchRequest = body as ProfilePatchRequest;
  const { profileKind, stream, profile } = patchRequest;
  if (!isProfileKind(profileKind)) {
    return createJsonErrorResponse('Invalid profile kind', 400, origin);
  }

  if (
    profileKind === 'student' &&
    stream !== undefined &&
    !isSpecialStream(stream)
  ) {
    return createJsonErrorResponse('Invalid honours stream', 400, origin);
  }

  if (!allowedKindsForRole(verified.target.role).includes(profileKind)) {
    return createJsonErrorResponse('Forbidden profile kind', 403, origin);
  }

  if (!isRecord(profile)) {
    return createJsonErrorResponse('Profile must be an object', 400, origin);
  }

  let studentPlacement: StudentPlacementResponse | undefined;
  if (profileKind === 'student') {
    try {
      const placement = await resolveStudentPlacement({
        env,
        targetEmail: verified.target.email,
        request: profile,
      });
      if (!placement.ok) {
        return createJsonErrorResponse(
          placement.message,
          placement.status,
          origin
        );
      }
      studentPlacement = placement.placement;
    } catch {
      return createJsonErrorResponse(
        'Unable to resolve student placement',
        502,
        origin
      );
    }
  }

  const trustedProfile = trustedProfileForTarget({
    profileKind,
    profile,
    targetEmail: verified.target.email,
    studentPlacement,
  });

  const parseResult = schemas[profileKind].safeParse(trustedProfile);
  if (!parseResult.success) {
    return createJsonResponse(
      {
        error: 'Profile validation failed',
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
      origin
    );
  }
  const validatedProfile = {
    ...(parseResult.data as Record<string, unknown>),
    ...(profileKind === 'student' ? trustedProfile : {}),
  } as PublicProfile;
  const username = usernameFromProfile(validatedProfile);
  const targetUsername = usernameFromEmail(verified.target.email);
  if (!username || username !== targetUsername) {
    return createJsonErrorResponse(
      'Profile identity must match the target user',
      403,
      origin
    );
  }

  const paths = targetPaths({
    profileKind,
    stream,
    profile: validatedProfile,
    username,
  });
  if (!paths) {
    return createJsonErrorResponse(
      'Unable to derive profile data paths',
      400,
      origin
    );
  }

  const mutationRequest = {
    username,
    updatedBy: verified.actor.email,
    updatedByType: 'admin' as const,
    profileKind,
    userPath: paths.userPath,
    aggregatePaths: paths.aggregatePaths,
    expectedUserFileSha: patchRequest.concurrency?.expectedUserFileSha,
    expectedPrHeadSha: patchRequest.concurrency?.expectedPrHeadSha,
    profile: validatedProfile,
  };
  if (req.headers.get('Prefer')?.includes('respond-async')) {
    return submitProfileOperation({
      env,
      origin,
      actorEmail: verified.actor.email,
      request: mutationRequest,
      control: patchRequest.control,
    });
  }

  const response = await callGithubApp<{
    success: boolean;
    pullRequest: PublicProfilePr;
  }>(env, origin, '/people/public-profile/pr', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mutationRequest),
  });
  if (!response.ok) return response.response;

  return createJsonResponse(response.value.pullRequest, 200, origin);
}

export async function getProfileOperation(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const user = await verifiedUser(req, env);
  if (!user.ok) return user.response;
  const operationId = new URL(req.url).pathname.split('/').at(-1);
  if (!operationId) {
    return createJsonErrorResponse('Operation ID is required', 400, origin);
  }
  const response = await callGithubApp<OperationStatusResponse>(
    env,
    origin,
    `/operations/${encodeURIComponent(operationId)}`,
    {
      method: req.method,
      headers: {
        'X-Actor-Subject-Id': await actorSubjectId(user.email),
      },
    }
  );
  if (!response.ok) return response.response;
  return createJsonResponse(response.value, 200, origin);
}

export async function discardAdminUserPublicProfilePr(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const verified = await verifiedAdminTarget(req, env);
  if (!verified.ok) return verified.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400, origin);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return createJsonErrorResponse(
      'Request body must be an object',
      400,
      origin
    );
  }

  const { prNumber, expectedHeadSha, reason } = body as DiscardProfilePrRequest;
  if (
    !Number.isInteger(prNumber) ||
    prNumber <= 0 ||
    typeof expectedHeadSha !== 'string' ||
    !/^[a-f0-9]{40}$/i.test(expectedHeadSha)
  ) {
    return createJsonErrorResponse(
      'Invalid draft discard request',
      400,
      origin
    );
  }

  const username = usernameFromEmail(verified.target.email);
  const response = await callGithubApp<{ success: true }>(
    env,
    origin,
    '/people/public-profile/pr',
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        updatedBy: verified.actor.email,
        prNumber,
        expectedHeadSha,
        reason: reason?.trim() || 'Superseded by newer public profile data',
      }),
    }
  );
  if (!response.ok) return response.response;

  return createJsonResponse(response.value, 200, origin);
}
