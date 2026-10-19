import {
  type AcademicSupportStaff,
  AcademicSupportStaffSchema,
  type AcademicTeachingStaff,
  AcademicTeachingStaffSchema,
  type NonAcademicStaff,
  NonAcademicStaffSchema,
  type Staff,
  StaffSchema,
  type Student,
  StudentSchema,
} from '@scs/schemas';

import { dataConfig } from '@/config/data.config';
import publicEnvConfig from '@/config/public.env.config';
import { isSubjectSlug, type SubjectSlug } from '@/config/subjects';

export type PeopleBatchCategory = 'CURRENT' | 'ALUMNI';
export type StudentSubject = SubjectSlug;

export interface PeopleBatch {
  id: string;
  displayName: string;
  defaultCategory: PeopleBatchCategory;
  intakeYear: number;
}

export interface PeopleProgramme {
  slug: string;
  directory: string;
  name: string;
  icon?: string;
  batches: string[];
}

export interface PeopleManifest {
  version: string;
  batches: PeopleBatch[];
  programmes: PeopleProgramme[];
}

export interface StudentStreamDefinition {
  stream: string;
  label: string;
  directory?: string;
  publicDirectory: boolean;
}

export interface ProgrammeBatchStudents {
  batch: PeopleBatch;
  students: Student[];
}

export interface StudentDirectoryContext {
  subject: StudentSubject;
  programme: PeopleProgramme;
  batch: PeopleBatch;
}

export interface PersonProject {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  status: string;
  role: string;
}

export interface PeopleSearchEntry {
  id: string;
  type: 'STAFF' | 'STUDENT';
  identity: string;
  href: string;
  name: string;
  subtitle: string;
  email?: string;
  keywords: string[];
}

interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const peopleDataCache = new Map<string, CacheEntry<unknown>>();

const AcademicStaffListSchema = AcademicTeachingStaffSchema.array();
const AcademicSupportStaffListSchema = AcademicSupportStaffSchema.array();
const NonAcademicStaffListSchema = NonAcademicStaffSchema.array();
const StudentListSchema = StudentSchema.array();
const EMPTY_PEOPLE_MANIFEST: PeopleManifest = {
  version: 'empty',
  batches: [],
  programmes: [],
};

const PersonProfileSchema = {
  parse(input: unknown): Staff | Student {
    const staff = StaffSchema.safeParse(input);
    if (staff.success) return staff.data;
    return StudentSchema.parse(input);
  },
};

const PersonProjectsSchema = {
  parse(input: unknown): PersonProject[] {
    if (!Array.isArray(input)) return [];

    return input
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }

        const record = entry as Partial<PersonProject>;
        if (
          typeof record.id !== 'string' ||
          typeof record.slug !== 'string' ||
          typeof record.title !== 'string' ||
          typeof record.shortDescription !== 'string' ||
          typeof record.status !== 'string' ||
          typeof record.role !== 'string'
        ) {
          return null;
        }

        return {
          id: record.id,
          slug: record.slug,
          title: record.title,
          shortDescription: record.shortDescription,
          status: record.status,
          role: record.role,
        };
      })
      .filter((entry): entry is PersonProject => Boolean(entry));
  },
};

const PeopleSearchIndexSchema = {
  parse(input: unknown): PeopleSearchEntry[] {
    if (!Array.isArray(input)) {
      throw new TypeError('Expected people search index to be an array');
    }

    return input.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new TypeError('Invalid people search entry');
      }

      const record = entry as Partial<PeopleSearchEntry>;
      if (
        typeof record.id !== 'string' ||
        (record.type !== 'STAFF' && record.type !== 'STUDENT') ||
        typeof record.identity !== 'string' ||
        typeof record.href !== 'string' ||
        typeof record.name !== 'string' ||
        typeof record.subtitle !== 'string' ||
        !Array.isArray(record.keywords) ||
        !record.keywords.every((keyword) => typeof keyword === 'string') ||
        (record.email !== undefined && typeof record.email !== 'string')
      ) {
        throw new TypeError('Invalid people search entry');
      }

      return {
        id: record.id,
        type: record.type,
        identity: record.identity,
        href: record.href,
        name: record.name,
        subtitle: record.subtitle,
        ...(record.email ? { email: record.email } : {}),
        keywords: record.keywords,
      };
    });
  },
};

const PeopleManifestSchema = {
  parse(input: unknown): PeopleManifest {
    if (!input || typeof input !== 'object') {
      throw new TypeError('Expected people manifest to be an object');
    }

    const manifest = input as Partial<PeopleManifest>;
    if (
      typeof manifest.version !== 'string' ||
      !Array.isArray(manifest.batches) ||
      !Array.isArray(manifest.programmes)
    ) {
      throw new TypeError('Invalid people manifest');
    }

    for (const batch of manifest.batches) {
      if (
        !batch ||
        typeof batch.id !== 'string' ||
        typeof batch.displayName !== 'string' ||
        (batch.defaultCategory !== 'CURRENT' &&
          batch.defaultCategory !== 'ALUMNI') ||
        typeof batch.intakeYear !== 'number'
      ) {
        throw new TypeError('Invalid batch in people manifest');
      }
    }

    for (const programme of manifest.programmes) {
      if (
        !programme ||
        typeof programme.slug !== 'string' ||
        typeof programme.directory !== 'string' ||
        typeof programme.name !== 'string' ||
        !Array.isArray(programme.batches) ||
        !programme.batches.every((batch) => typeof batch === 'string')
      ) {
        throw new TypeError('Invalid programme in people manifest');
      }
    }

    return manifest as PeopleManifest;
  },
};

const StudentStreamDefinitionListSchema = {
  parse(input: unknown): StudentStreamDefinition[] {
    if (!Array.isArray(input)) return [];

    return input.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return [];
      }

      const record = entry as Partial<StudentStreamDefinition>;
      if (
        typeof record.stream !== 'string' ||
        typeof record.label !== 'string' ||
        (record.directory !== undefined &&
          typeof record.directory !== 'string') ||
        typeof record.publicDirectory !== 'boolean'
      ) {
        return [];
      }

      return [
        {
          stream: record.stream,
          label: record.label,
          ...(record.directory ? { directory: record.directory } : {}),
          publicDirectory: record.publicDirectory,
        },
      ];
    });
  },
};

async function fetchPeopleData<T>(
  path: string,
  schema: { parse(input: unknown): T },
  notFoundValue?: T
): Promise<T> {
  const now = Date.now();
  const cached = peopleDataCache.get(path);

  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  const promise = fetchPeopleDataUncached(path, schema, notFoundValue).catch(
    (error) => {
      peopleDataCache.delete(path);
      throw error;
    }
  );

  peopleDataCache.set(path, {
    expiresAt: now + dataConfig.cacheTtlMs,
    promise,
  });

  return promise;
}

async function fetchPeopleDataUncached<T>(
  path: string,
  schema: { parse(input: unknown): T },
  notFoundValue?: T
): Promise<T> {
  const response = await fetch(
    `${publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL}/${path}`,
    {
      cache: 'no-store',
    }
  );

  if (response.status === 404 && notFoundValue !== undefined) {
    return schema.parse(notFoundValue);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch people data from ${path}: ${response.status} ${response.statusText}`
    );
  }

  return schema.parse(await response.json());
}

function prefetchPeopleData<T>(
  path: string,
  schema: { parse(input: unknown): T },
  notFoundValue?: T
): void {
  void fetchPeopleData(path, schema, notFoundValue).catch(() => undefined);
}

export function getPeopleManifest(): Promise<PeopleManifest> {
  return fetchPeopleData(
    'manifest.json',
    PeopleManifestSchema,
    EMPTY_PEOPLE_MANIFEST
  );
}

export function prefetchPeopleManifest(): void {
  prefetchPeopleData(
    'manifest.json',
    PeopleManifestSchema,
    EMPTY_PEOPLE_MANIFEST
  );
}

export function getStudentStreamDefinitions(): Promise<
  StudentStreamDefinition[]
> {
  return fetchPeopleData(
    'student-streams.json',
    StudentStreamDefinitionListSchema,
    []
  );
}

export function prefetchStudentStreamDefinitions(): void {
  prefetchPeopleData(
    'student-streams.json',
    StudentStreamDefinitionListSchema,
    []
  );
}

export function getPeopleSearchIndex(): Promise<PeopleSearchEntry[]> {
  return fetchPeopleData('search.json', PeopleSearchIndexSchema, []);
}

export function prefetchPeopleSearchIndex(): void {
  prefetchPeopleData('search.json', PeopleSearchIndexSchema, []);
}

export async function getProgramme(
  slug: string
): Promise<PeopleProgramme | undefined> {
  const manifest = await getPeopleManifest();
  return manifest.programmes.find((programme) => programme.slug === slug);
}

export function getPerson(identity: string): Promise<Staff | Student> {
  return fetchPeopleData(
    `users/${encodeURIComponent(identity.toLowerCase())}.json`,
    PersonProfileSchema
  );
}

export async function getPersonProjects(
  username: string
): Promise<PersonProject[]> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) return [];

  const response = await fetch(
    `${publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL}/by-person/${encodeURIComponent(
      normalizedUsername
    )}.json`,
    {
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project index for ${normalizedUsername}: ${response.status} ${response.statusText}`
    );
  }

  return PersonProjectsSchema.parse(await response.json());
}

export function prefetchPerson(identity?: string): void {
  if (!identity) return;

  prefetchPeopleData(
    `users/${encodeURIComponent(identity.toLowerCase())}.json`,
    PersonProfileSchema
  );
}

export function getAcademicStaff(): Promise<AcademicTeachingStaff[]> {
  return fetchPeopleData('staff/academic.json', AcademicStaffListSchema, []);
}

export function prefetchAcademicStaff(): void {
  prefetchPeopleData('staff/academic.json', AcademicStaffListSchema, []);
}

export function getAcademicSupportStaff(): Promise<AcademicSupportStaff[]> {
  return fetchPeopleData(
    'staff/academic-support.json',
    AcademicSupportStaffListSchema,
    []
  );
}

export function prefetchAcademicSupportStaff(): void {
  prefetchPeopleData(
    'staff/academic-support.json',
    AcademicSupportStaffListSchema,
    []
  );
}

export function getNonAcademicStaff(): Promise<NonAcademicStaff[]> {
  return fetchPeopleData(
    'staff/non-academic.json',
    NonAcademicStaffListSchema,
    []
  );
}

export function prefetchNonAcademicStaff(): void {
  prefetchPeopleData('staff/non-academic.json', NonAcademicStaffListSchema, []);
}

export function prefetchStaffDirectories(): void {
  prefetchAcademicStaff();
  prefetchAcademicSupportStaff();
  prefetchNonAcademicStaff();
}

export function getStudent(registrationNo: string): Promise<Student> {
  return fetchPeopleData(
    `users/${encodeURIComponent(registrationNo.toLowerCase())}.json`,
    StudentSchema
  );
}

export function getStudentsByBatch(batch: string): Promise<Student[]> {
  return fetchPeopleData(
    `students/${encodeURIComponent(batch.toLowerCase())}.json`,
    StudentListSchema,
    []
  );
}

export function getSpecialStudents(
  programme: Pick<PeopleProgramme, 'directory'>,
  batch: string
): Promise<Student[]> {
  return fetchPeopleData(
    `special/${encodeURIComponent(programme.directory)}/${encodeURIComponent(batch.toLowerCase())}.json`,
    StudentListSchema,
    []
  );
}

export function prefetchSpecialStudents(
  programme: Pick<PeopleProgramme, 'directory'> | undefined,
  batch: string | undefined
): void {
  if (!programme || !batch) return;

  prefetchPeopleData(
    `special/${encodeURIComponent(programme.directory)}/${encodeURIComponent(batch.toLowerCase())}.json`,
    StudentListSchema,
    []
  );
}

function getProgrammeBatchesFromManifest(
  manifest: PeopleManifest,
  programme: PeopleProgramme
): PeopleBatch[] {
  const programmeBatchIds = new Set(
    programme.batches.map((batch) => batch.toLowerCase())
  );

  return manifest.batches
    .filter((batch) => programmeBatchIds.has(batch.id.toLowerCase()))
    .sort((a, b) => b.intakeYear - a.intakeYear);
}

export function prefetchSubject(subject: StudentSubject): void {
  void (async () => {
    try {
      const manifest = await getPeopleManifest();
      const programme = manifest.programmes.find(
        (candidate) => candidate.slug === subject
      );
      if (!programme) return;

      const batches = getProgrammeBatchesFromManifest(manifest, programme);
      const likelyBatches = [
        ...batches
          .filter((batch) => batch.defaultCategory !== 'ALUMNI')
          .slice(0, 2),
        ...batches
          .filter((batch) => batch.defaultCategory === 'ALUMNI')
          .slice(0, 2),
      ];

      likelyBatches.forEach((batch) => {
        prefetchSpecialStudents(programme, batch.id);
      });
    } catch {
      // Prefetch should never disturb visible page loading.
    }
  })();
}

export function prefetchAdjacentSubjectBatches(
  subject: StudentSubject,
  currentBatchSlug: string
): void {
  void (async () => {
    try {
      const manifest = await getPeopleManifest();
      const programme = manifest.programmes.find(
        (candidate) => candidate.slug === subject
      );
      if (!programme) return;

      const currentBatchId =
        `s${currentBatchSlug.replace(/^s/i, '')}`.toLowerCase();
      const batches = getProgrammeBatchesFromManifest(manifest, programme);
      const currentIndex = batches.findIndex(
        (batch) => batch.id.toLowerCase() === currentBatchId
      );
      if (currentIndex === -1) return;

      [batches[currentIndex - 1], batches[currentIndex + 1]].forEach(
        (batch) => {
          prefetchSpecialStudents(programme, batch?.id);
        }
      );
    } catch {
      // Prefetch should never disturb visible page loading.
    }
  })();
}

export function prefetchPeopleProfiles(
  identities: Array<string | undefined>
): void {
  identities.slice(0, 12).forEach((identity) => {
    prefetchPerson(identity);
  });
}

function getProgrammeBatchDefinitions(
  manifest: PeopleManifest,
  programme: PeopleProgramme,
  category: PeopleBatchCategory
): PeopleBatch[] {
  return getProgrammeBatchesFromManifest(manifest, programme).filter(
    (batch) => batch.defaultCategory === category
  );
}

async function loadProgrammeBatches(
  programme: PeopleProgramme,
  batches: PeopleBatch[],
  category: PeopleBatchCategory
): Promise<ProgrammeBatchStudents[]> {
  const results = await Promise.allSettled(
    batches.map(async (batch) => ({
      batch,
      students: (await getSpecialStudents(programme, batch.id)).filter(
        (student) =>
          category === 'ALUMNI'
            ? student.status === 'ALUMNI'
            : student.status !== 'ALUMNI'
      ),
    }))
  );

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
}

export async function getProgrammeCurrentBatches(
  programme: PeopleProgramme
): Promise<ProgrammeBatchStudents[]> {
  const manifest = await getPeopleManifest();
  const batches = getProgrammeBatchDefinitions(manifest, programme, 'CURRENT');
  return loadProgrammeBatches(programme, batches, 'CURRENT');
}

export async function getSubjectCurrentBatches(
  subject: StudentSubject
): Promise<Array<{ batch: string; students: Student[] }>> {
  const programme = await getProgramme(subject);
  if (!programme) return [];

  const batches = await getProgrammeCurrentBatches(programme);
  return batches.map(({ batch, students }) => ({
    batch: batch.id,
    students,
  }));
}

export async function getSubjectPublishedBatches(
  subject: StudentSubject
): Promise<ProgrammeBatchStudents[]> {
  const [manifest, programme] = await Promise.all([
    getPeopleManifest(),
    getProgramme(subject),
  ]);
  if (!programme) return [];

  const batches = getProgrammeBatchesFromManifest(manifest, programme);

  const results = await Promise.allSettled(
    batches.map(async (batch) => {
      const students = await getSpecialStudents(programme, batch.id);
      return {
        batch,
        students:
          batch.defaultCategory === 'ALUMNI'
            ? students.filter((student) => student.status === 'ALUMNI')
            : students.filter((student) => student.status !== 'ALUMNI'),
      };
    })
  );

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
}

export async function getSubjectPublishedBatchDefinitions(
  subject: StudentSubject
): Promise<PeopleBatch[]> {
  const [manifest, programme] = await Promise.all([
    getPeopleManifest(),
    getProgramme(subject),
  ]);
  if (!programme) return [];

  return getProgrammeBatchesFromManifest(manifest, programme);
}

export async function getStudentDirectoryContext(
  registrationNo: string
): Promise<StudentDirectoryContext | undefined> {
  const manifest = await getPeopleManifest();
  const normalizedRegistrationNo = registrationNo.toLowerCase();

  for (const programme of manifest.programmes) {
    if (!isSubjectSlug(programme.slug)) continue;

    for (const batchId of programme.batches) {
      const students = await getSpecialStudents(programme, batchId);
      const hasStudent = students.some(
        (student) =>
          student.registrationNo.toLowerCase() === normalizedRegistrationNo
      );

      if (!hasStudent) continue;

      const batch = manifest.batches.find(
        (candidate) => candidate.id.toLowerCase() === batchId.toLowerCase()
      );

      if (!batch) return undefined;

      return {
        subject: programme.slug,
        programme,
        batch,
      };
    }
  }

  return undefined;
}
