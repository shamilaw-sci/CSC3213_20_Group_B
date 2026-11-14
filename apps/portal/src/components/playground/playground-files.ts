import {
  type PlaygroundKind,
  playgroundTarget,
} from '@/components/playground/playground-data';
import { isRecord } from '@/lib/is-record';

type JsonRecord = Record<string, unknown>;

export interface PlaygroundFile {
  path: string;
  value: unknown | null;
  guidance: string;
  action: 'create' | 'replace' | 'remove' | 'unchanged';
}

function stringValue(record: JsonRecord | null, key: string) {
  return typeof record?.[key] === 'string' ? (record[key] as string) : '';
}

function identity(record: JsonRecord | null) {
  return (
    stringValue(record, 'registrationNo') ||
    stringValue(record, 'email').split('@')[0] ||
    ''
  ).toLowerCase();
}

function peopleSearchEntry(record: JsonRecord): JsonRecord {
  const username = identity(record);
  const staffType = stringValue(record, 'staffType');
  const kind =
    staffType === 'ACADEMIC_TEACHING'
      ? 'Academic Staff'
      : staffType === 'ACADEMIC_SUPPORT'
        ? 'Academic Support Staff'
        : staffType === 'NON_ACADEMIC'
          ? 'Non-Academic Staff'
          : '';
  const type = kind ? 'STAFF' : 'STUDENT';
  const title = stringValue(record, 'title');
  const fullName = stringValue(record, 'fullName');
  const name = [title, fullName].filter(Boolean).join(' ').trim();
  const email = stringValue(record, 'email');
  const personalEmail = stringValue(record, 'personalEmail');
  const keywords = [
    ...new Set(
      [
        username,
        fullName,
        name,
        email,
        email.split('@')[0],
        personalEmail,
        stringValue(record, 'registrationNo'),
      ]
        .map((value) => value?.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  return {
    id: `${type.toLowerCase()}:${username}`,
    type,
    identity: username,
    href: `/people/${username}`,
    name: name || fullName,
    subtitle: kind || (record.status === 'ALUMNI' ? 'Alumni' : 'Student'),
    ...(email ? { email } : {}),
    keywords,
  };
}

function projectPersonEntry(
  project: JsonRecord,
  person: JsonRecord
): JsonRecord {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    shortDescription: project.shortDescription,
    projectType: project.projectType,
    status: project.status,
    categories: project.categories,
    tags: project.tags,
    academicYear: project.academicYear,
    role: person.role,
    href: `projects/${String(project.slug)}.json`,
    lastUpdatedAt: isRecord(project.dates)
      ? project.dates.lastUpdatedAt
      : undefined,
  };
}

function records(value: unknown, path: string): JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord))
    throw new Error(
      `Published ${path} is not a record list. Run the data repository generator instead.`
    );
  return value;
}

function upsert(
  current: JsonRecord[],
  record: JsonRecord,
  key: string,
  oldKey?: string
) {
  const nextKey = stringValue(record, key).toLowerCase();
  const previousKey = oldKey?.toLowerCase();
  const next = current.filter((item) => {
    const value = stringValue(item, key).toLowerCase();
    return value !== nextKey && (!previousKey || value !== previousKey);
  });
  next.push(record);
  next.sort((left, right) =>
    stringValue(left, key).localeCompare(stringValue(right, key))
  );
  return next;
}

function positionHint(items: JsonRecord[], key: string, selected: string) {
  const index = items.findIndex(
    (item) => stringValue(item, key).toLowerCase() === selected.toLowerCase()
  );
  if (index < 0) return '';
  const before = index > 0 ? stringValue(items[index - 1] ?? {}, key) : '';
  const after =
    index + 1 < items.length ? stringValue(items[index + 1] ?? {}, key) : '';
  const neighbors =
    before && after
      ? `between ${before} and ${after}`
      : before
        ? `after ${before}`
        : after
          ? `before ${after}`
          : 'as the only entry';
  return ` at position ${index + 1} (${neighbors})`;
}

function arrayFile(
  path: string,
  current: JsonRecord[],
  next: JsonRecord[],
  key: string,
  newKey: string,
  oldKey?: string
): PlaygroundFile {
  if (JSON.stringify(current) === JSON.stringify(next))
    return {
      path,
      value: next,
      action: 'unchanged',
      guidance: 'This file needs no change.',
    };
  if (next.length === 0)
    return {
      path,
      value: null,
      action: 'remove',
      guidance: `Remove this file after the old ${oldKey ?? newKey} entry moves out.`,
    };
  const oldExists = current.some(
    (item) =>
      stringValue(item, key).toLowerCase() === (oldKey ?? newKey).toLowerCase()
  );
  const newExists = next.some(
    (item) => stringValue(item, key).toLowerCase() === newKey.toLowerCase()
  );
  const action = oldExists ? 'replace' : 'create';
  const guidance = newExists
    ? `${oldExists ? 'Replace' : 'Add'} the ${newKey} entry${positionHint(next, key, newKey)}. Keep every other entry.`
    : `Remove the old ${oldKey ?? newKey} entry. Keep every other entry.`;
  return { path, value: next, action, guidance };
}

async function readPublicJson(
  base: string,
  path: string
): Promise<unknown | null> {
  const response = await fetch(`${base}/${path.replace(/^public\//, '')}`, {
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Could not read ${path} (${response.status}).`);
  const text = await response.text();
  if (text.length > 5_000_000)
    throw new Error(`${path} is too large to prepare in the browser.`);
  return JSON.parse(text) as unknown;
}

export async function preparePlaygroundFiles({
  kind,
  record,
  published,
  target,
  related,
  base,
}: {
  kind: PlaygroundKind;
  record: JsonRecord;
  published: JsonRecord | null;
  target: string;
  related: string[];
  base: string;
}): Promise<PlaygroundFile[]> {
  const files: PlaygroundFile[] = [
    {
      path: target,
      value: record,
      action:
        published && playgroundTarget(kind, published) === target
          ? 'replace'
          : 'create',
      guidance:
        published && playgroundTarget(kind, published) === target
          ? 'Replace this record file with the JSON below. Review changes above shows what changed.'
          : 'Create this new record file with the JSON below.',
    },
  ];
  const previousPath = published ? playgroundTarget(kind, published) : null;
  if (previousPath && previousPath !== target) {
    files.push({
      path: previousPath,
      value: null,
      action: 'remove',
      guidance:
        'Remove the old record file after creating the new path. The related collections below remove its old entry.',
    });
  }
  const sources = new Map<string, unknown | null>();
  const sourcePaths =
    kind === 'project' ? ['public/projects/v2/projects.json'] : related;
  await Promise.all(
    sourcePaths.map(async (path) => {
      sources.set(path, await readPublicJson(base, path));
    })
  );

  if (kind === 'course' || kind === 'offering') {
    const path = related[0];
    if (!path) return files;
    const current = records(sources.get(path), path);
    const next = upsert(current, record, 'id', stringValue(published, 'id'));
    files.push(
      arrayFile(
        path,
        current,
        next,
        'id',
        stringValue(record, 'id'),
        stringValue(published, 'id')
      )
    );
    return files;
  }

  if (kind === 'project') {
    const path = 'public/projects/v2/projects.json';
    const current = records(sources.get(path), path);
    const next = upsert(
      current,
      record,
      'slug',
      stringValue(published, 'slug')
    );
    files.push(
      arrayFile(
        path,
        current,
        next,
        'slug',
        stringValue(record, 'slug'),
        stringValue(published, 'slug')
      )
    );
    files.push({
      path: 'public/projects/v2/manifest.json',
      value: {
        version: 'v2',
        projects: next.map((project) => ({
          id: project.id,
          slug: project.slug,
          title: project.title,
          href: `projects/${String(project.slug)}.json`,
        })),
      },
      action: published ? 'replace' : 'create',
      guidance: `${published ? 'Replace' : 'Add'} the ${String(record.slug)} project entry in the projects list. Keep the other entries in slug order.`,
    });
    for (const byPersonPath of related.filter((item) =>
      item.includes('/by-person/')
    )) {
      const username =
        byPersonPath
          .split('/')
          .at(-1)
          ?.replace(/\.json$/, '') ?? '';
      const oldEntries = current.flatMap((project) =>
        (Array.isArray(project.people) ? project.people : [])
          .filter(isRecord)
          .filter(
            (person) =>
              stringValue(person, 'username').toLowerCase() === username
          )
          .map((person) => projectPersonEntry(project, person))
      );
      const newEntries = next
        .flatMap((project) =>
          (Array.isArray(project.people) ? project.people : [])
            .filter(isRecord)
            .filter(
              (person) =>
                stringValue(person, 'username').toLowerCase() === username
            )
            .map((person) => projectPersonEntry(project, person))
        )
        .sort(
          (left, right) =>
            stringValue(left, 'title').localeCompare(
              stringValue(right, 'title')
            ) ||
            stringValue(left, 'slug').localeCompare(stringValue(right, 'slug'))
        );
      files.push(
        arrayFile(
          byPersonPath,
          oldEntries,
          newEntries,
          'slug',
          stringValue(record, 'slug'),
          stringValue(published, 'slug')
        )
      );
    }
    return files;
  }

  const currentIdentity = identity(record);
  const oldIdentity = identity(published);
  for (const path of related) {
    if (path.endsWith('/manifest.json')) {
      const current = sources.get(path);
      if (!isRecord(current))
        throw new Error(`Published ${path} is unavailable.`);
      const batches = Array.isArray(current.batches)
        ? current.batches.filter(isRecord)
        : [];
      const batchPaths = related.filter((item) => item.includes('/students/'));
      const changedBatches = batchPaths.map((batchPath) => {
        const batch =
          batchPath
            .split('/')
            .at(-1)
            ?.replace(/\.json$/, '') ?? '';
        const currentBatch = records(sources.get(batchPath) ?? [], batchPath);
        const nextBatch = currentBatch.filter(
          (item) =>
            identity(item) !== oldIdentity && identity(item) !== currentIdentity
        );
        if (currentIdentity.startsWith(batch)) nextBatch.push(record);
        return { batch, count: nextBatch.length };
      });
      const kept = batches.filter(
        (item) => !changedBatches.some(({ batch }) => item.id === batch)
      );
      const updated = [
        ...kept,
        ...changedBatches
          .filter(({ count }) => count > 0)
          .map(({ batch }) => ({
            id: batch,
            displayName: batch.toUpperCase(),
            defaultCategory: 'CURRENT',
            intakeYear: 2000 + Number(batch.slice(1)),
          })),
      ].sort((left, right) =>
        stringValue(left, 'id').localeCompare(stringValue(right, 'id'))
      );
      const value = { ...current, batches: updated };
      files.push({
        path,
        value,
        action:
          JSON.stringify(value) === JSON.stringify(current)
            ? 'unchanged'
            : 'replace',
        guidance:
          'Update the batch list if a batch was added or removed. Keep programme entries unchanged; the repository generator refreshes special-programme membership.',
      });
      continue;
    }
    if (path.endsWith('/search.json')) {
      const current = records(sources.get(path), path);
      const next = upsert(
        current,
        peopleSearchEntry(record),
        'id',
        oldIdentity
          ? `${published?.staffType ? 'staff' : 'student'}:${oldIdentity}`
          : undefined
      );
      files.push(
        arrayFile(
          path,
          current,
          next,
          'id',
          `${kind === 'student' ? 'student' : 'staff'}:${currentIdentity}`,
          oldIdentity
            ? `${kind === 'student' ? 'student' : 'staff'}:${oldIdentity}`
            : undefined
        )
      );
      continue;
    }
    const current = records(sources.get(path) ?? [], path);
    const next = current.filter(
      (item) =>
        identity(item) !== oldIdentity && identity(item) !== currentIdentity
    );
    const belongs =
      kind === 'student'
        ? path.endsWith(`/students/${currentIdentity.slice(0, 3)}.json`)
        : path.endsWith(
            `/staff/${kind === 'academic' ? 'academic' : kind}.json`
          ) ||
          path.endsWith(
            `/staff/${stringValue(record, 'department').toLowerCase().replaceAll('_', '-')}/${kind === 'academic' ? 'academic' : kind}.json`
          );
    if (belongs) next.push(record);
    next.sort((left, right) => identity(left).localeCompare(identity(right)));
    files.push(
      arrayFile(
        path,
        current,
        next,
        kind === 'student' ? 'registrationNo' : 'email',
        kind === 'student'
          ? stringValue(record, 'registrationNo')
          : stringValue(record, 'email'),
        kind === 'student'
          ? stringValue(published, 'registrationNo')
          : stringValue(published, 'email')
      )
    );
  }
  if (kind === 'student' && published) {
    const manifest = sources.get('public/people/v2/manifest.json');
    if (isRecord(manifest) && Array.isArray(manifest.programmes)) {
      const oldBatch = oldIdentity.slice(0, 3);
      const candidatePaths = manifest.programmes
        .filter(isRecord)
        .filter(
          (programme) =>
            Array.isArray(programme.batches) &&
            programme.batches.includes(oldBatch) &&
            /^[a-z0-9-]+$/.test(stringValue(programme, 'directory'))
        )
        .map(
          (programme) =>
            `public/people/v2/special/${stringValue(programme, 'directory')}/${oldBatch}.json`
        );
      if (candidatePaths.length > 40)
        throw new Error(
          'Too many special-programme files to check in the browser. Run the repository generator.'
        );
      const candidates = await Promise.all(
        candidatePaths.map(async (path) => ({
          path,
          current: records(await readPublicJson(base, path), path),
        }))
      );
      for (const { path, current } of candidates) {
        if (!current.some((item) => identity(item) === oldIdentity)) continue;
        const next = upsert(
          current,
          record,
          'registrationNo',
          stringValue(published, 'registrationNo')
        );
        files.push(
          arrayFile(
            path,
            current,
            next,
            'registrationNo',
            stringValue(record, 'registrationNo'),
            stringValue(published, 'registrationNo')
          )
        );
      }
    }
  }
  return files;
}
