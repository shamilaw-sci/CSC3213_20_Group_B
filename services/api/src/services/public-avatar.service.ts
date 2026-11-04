import {
  createJsonErrorResponse,
  createJsonResponse,
  getRequestOrigin,
} from '@/http/responses';
import { verifyIdentitySession } from '@/middleware/session';
import {
  getPermissionRole,
  getUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

const ROOT = '/api/people/v2/avatars/';
const MAX_UPLOAD = 4 * 1024 * 1024;
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const HASH = /^[a-f0-9]{64}$/;
const MIN_SIDE = 280;
const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;
const HOUR = 3_600_000;
const MAX_ATTEMPTS = 6;

type Pointer = {
  version: 1;
  key: string | null;
  sha256: string | null;
  contentType: 'image/webp' | null;
  size: number;
  updatedAt: string;
};

type Moderation =
  | { status: 'approved' }
  | { status: 'rejected'; reason: string }
  | { status: 'review_required'; reason: string };

function bodyStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Blob([bytes.slice().buffer]).stream();
}

function pointerKey(username: string): string {
  return `avatars/${username}/current.json`;
}

function imageKey(username: string, hash: string): string {
  return `avatars/${username}/${hash}.webp`;
}

function imageUrl(request: Request, username: string, hash: string): string {
  return `${new URL(request.url).origin}${ROOT}${username}/${hash}.webp`;
}

export function formatFromMagic(
  bytes: Uint8Array
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export function animated(bytes: Uint8Array, format: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'image/png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) return true;
      if (
        String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === 'acTL'
      )
        return true;
      offset += 12 + length;
    }
  }
  if (format === 'image/webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = view.getUint32(offset + 4, true);
      if (length > bytes.length - offset - 8) return true;
      const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
      if (
        chunk === 'ANIM' ||
        (chunk === 'VP8X' && length >= 1 && Boolean(bytes[offset + 8] & 0x02))
      )
        return true;
      offset += 8 + length + (length % 2);
    }
  }
  return false;
}

async function readPointer(
  bucket: R2Bucket,
  username: string
): Promise<{ value: Pointer | null; etag: string | null }> {
  const object = await bucket.get(pointerKey(username));
  if (!object || !('body' in object)) return { value: null, etag: null };
  const value: unknown = await object.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('key' in value) ||
    (value.key !== null && typeof value.key !== 'string')
  )
    throw new Error('Invalid avatar pointer');
  return { value: value as Pointer, etag: object.etag };
}

export function moderationDecision(payload: unknown): Moderation {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('answers' in payload) ||
    !payload.answers ||
    typeof payload.answers !== 'object'
  )
    return {
      status: 'review_required',
      reason: 'Moderation response unavailable',
    };
  const answers = payload.answers as Record<string, unknown>;
  const choice = (name: string, options: string[]) => {
    const answer = answers[name];
    if (!answer || typeof answer !== 'object') return null;
    const item = answer as Record<string, unknown>;
    if (
      item.type !== 'choice' ||
      typeof item.choice !== 'string' ||
      !options.includes(item.choice) ||
      typeof item.confidence !== 'number' ||
      !Number.isFinite(item.confidence) ||
      item.confidence < 0 ||
      item.confidence > 1 ||
      !item.probabilities ||
      typeof item.probabilities !== 'object'
    )
      return null;
    const probability = (item.probabilities as Record<string, unknown>)[
      item.choice
    ];
    if (
      typeof probability !== 'number' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    )
      return null;
    return { value: item.choice, confidence: item.confidence, probability };
  };
  const safety = choice('safety', [
    'safe',
    'sexual',
    'violence',
    'hate',
    'gesture',
    'uncertain',
  ]);
  const suitability = choice('suitability', [
    'portrait',
    'blurry',
    'obscured',
    'non_portrait',
    'meme_logo',
    'multiple',
    'uncertain',
  ]);
  if (!safety || !suitability)
    return {
      status: 'review_required',
      reason: 'Moderation response unavailable',
    };
  if (
    safety.value !== 'safe' &&
    safety.value !== 'uncertain' &&
    safety.probability >= 0.85 &&
    safety.confidence >= 0.5
  )
    return {
      status: 'rejected',
      reason: 'Image does not meet public avatar safety rules',
    };
  if (
    suitability.value !== 'portrait' &&
    suitability.value !== 'uncertain' &&
    suitability.probability >= 0.85 &&
    suitability.confidence >= 0.5
  )
    return {
      status: 'rejected',
      reason: 'Image is not a suitable single-person portrait',
    };
  if (
    safety.value !== 'safe' ||
    suitability.value !== 'portrait' ||
    safety.probability < 0.9 ||
    suitability.probability < 0.9 ||
    safety.confidence < 0.65 ||
    suitability.confidence < 0.65
  )
    return { status: 'review_required', reason: 'Image needs manual review' };
  return { status: 'approved' };
}

export async function moderate(
  jpeg: Uint8Array,
  env: Env,
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch
): Promise<Moderation> {
  if (!env.TYPESAFE_API_KEY)
    return {
      status: 'review_required',
      reason: 'Moderation service unavailable',
    };
  const form = new FormData();
  form.append(
    'request',
    new Blob(
      [
        JSON.stringify({
          model: 'jev-latest',
          state: { photo: '<avatar-photo>' },
          assets: { '<avatar-photo>': { type: 'image', part: 'photo' } },
          questions: {
            safety: {
              type: 'choice',
              instructions:
                'Classify the visible safety content in `photo`. Judge only visible content.',
              criteria: {
                safe: 'No explicit sexual, graphic violent, hateful or extremist, or clearly inappropriate gesture content',
                sexual: 'Sexual nudity or explicit sexual content',
                violence: 'Graphic violence or gore',
                hate: 'Hateful or extremist symbol or content',
                gesture: 'Clearly inappropriate gesture',
                uncertain: 'Cannot reliably determine safety',
              },
            },
            suitability: {
              type: 'choice',
              instructions:
                'Classify `photo` as a public single-person profile portrait. Do not penalize clothing, ethnicity, religion, disability, hairstyle, age, or cultural appearance.',
              criteria: {
                portrait:
                  'One recognizable person with a reasonably visible face, including casual clothing',
                blurry: 'Portrait too blurry or low resolution',
                obscured: 'Face obscured or not clearly visible',
                non_portrait: 'No person or irrelevant scene',
                meme_logo: 'Screenshot, meme, illustration, or logo',
                multiple: 'Multiple people',
                uncertain: 'Cannot reliably determine portrait suitability',
              },
            },
          },
        }),
      ],
      { type: 'application/json' }
    ),
    'request'
  );
  form.append(
    'photo',
    new Blob([jpeg.slice().buffer], { type: 'image/jpeg' }),
    'avatar.jpg'
  );
  try {
    const response = await fetcher('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
        'TypeSafe-Danger-Zone-Images': 'true',
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return {
        status: 'review_required',
        reason: 'Moderation service unavailable',
      };
    return moderationDecision(await response.json());
  } catch {
    return {
      status: 'review_required',
      reason: 'Moderation service unavailable',
    };
  }
}

async function owner(
  req: Request,
  env: Env
): Promise<{ username: string } | Response> {
  const origin = getRequestOrigin(req);
  const session = await verifyIdentitySession(req, env, 'people');
  if (session instanceof Response) return session;
  const email = session.email.toLowerCase();
  const username = email.split('@')[0];
  if (!username || !USERNAME.test(username))
    return createJsonErrorResponse('Invalid public identity', 403, origin);
  const permission = await getUserPermission(email, env);
  if (
    !permission ||
    permission.blacklisted ||
    !['STUDENT', 'ACADEMIC', 'ACADEMIC_SUPPORT', 'NON_ACADEMIC'].includes(
      getPermissionRole(permission)
    )
  )
    return createJsonErrorResponse(
      'Public profile access required',
      403,
      origin
    );
  const profile = await fetch(
    new URL(`/people/v2/users/${username}.json`, env.DATA_PUBLIC_BASE_URL)
  );
  if (!profile.ok)
    return createJsonErrorResponse(
      'Published public profile required',
      profile.status === 404 ? 403 : 502,
      origin
    );
  const record: unknown = await profile.json();
  if (
    !record ||
    typeof record !== 'object' ||
    !('email' in record) ||
    typeof record.email !== 'string' ||
    record.email.toLowerCase() !== email
  )
    return createJsonErrorResponse(
      'Public profile ownership mismatch',
      403,
      origin
    );
  return { username };
}

async function rateLimit(env: Env, username: string): Promise<boolean> {
  const now = Date.now();
  const start = Math.floor(now / HOUR) * HOUR;
  const result = await env.AUTH_DB.prepare(
    `INSERT INTO public_avatar_rate (user_id, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END RETURNING attempts`
  )
    .bind(username, start)
    .first<{ attempts: number }>();
  return Boolean(result && result.attempts <= MAX_ATTEMPTS);
}

async function boundedMultipart(req: Request): Promise<FormData | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_UPLOAD + 16_384) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: bytes,
  }).formData();
}

export async function uploadMyAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  if (!(await rateLimit(env, identity.username)))
    return createJsonErrorResponse('Avatar upload limit reached', 429, origin);
  // Snapshot the pointer before processing so a slower earlier upload cannot
  // overwrite a newer successful request after moderation.
  const before = await readPointer(env.PROFILE_PICTURES, identity.username);
  const contentLength = Number(req.headers.get('content-length'));
  if (contentLength > MAX_UPLOAD + 16_384)
    return createJsonErrorResponse('Image exceeds 4 MiB', 413, origin);
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data'))
    return createJsonErrorResponse('Multipart image required', 415, origin);
  let form: FormData;
  try {
    const parsed = await boundedMultipart(req);
    if (!parsed)
      return createJsonErrorResponse('Image exceeds 4 MiB', 413, origin);
    form = parsed;
  } catch {
    return createJsonErrorResponse('Invalid multipart upload', 400, origin);
  }
  const file = form.get('image');
  if (
    !(file instanceof File) ||
    form.getAll('image').length !== 1 ||
    [...form.keys()].some((key) => key !== 'image')
  )
    return createJsonErrorResponse('One image is required', 400, origin);
  if (file.size === 0 || file.size > MAX_UPLOAD)
    return createJsonErrorResponse(
      'Image exceeds 4 MiB or is empty',
      413,
      origin
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formatFromMagic(bytes);
  if (!format || file.type !== format || animated(bytes, format))
    return createJsonErrorResponse(
      'Unsupported, animated, or spoofed image',
      415,
      origin
    );
  let webp: Uint8Array;
  let jpeg: Uint8Array;
  try {
    const info = await env.IMAGES.info(bodyStream(bytes));
    if (
      !('width' in info) ||
      info.format !== format ||
      info.width < MIN_SIDE ||
      info.height < MIN_SIDE ||
      info.width > MAX_SIDE ||
      info.height > MAX_SIDE ||
      info.width * info.height > MAX_PIXELS
    )
      return createJsonErrorResponse('Invalid image dimensions', 422, origin);
    const transform = { width: 512, height: 512, fit: 'cover' as const };
    const webpResponse = (
      await env.IMAGES.input(bodyStream(bytes))
        .transform(transform)
        .output({ format: 'image/webp', anim: false })
    ).response();
    const jpegResponse = (
      await env.IMAGES.input(bodyStream(bytes))
        .transform(transform)
        .output({ format: 'image/jpeg', anim: false })
    ).response();
    webp = new Uint8Array(await webpResponse.arrayBuffer());
    jpeg = new Uint8Array(await jpegResponse.arrayBuffer());
    if (!webp.length || !jpeg.length)
      throw new Error('Empty transformed image');
  } catch {
    return createJsonErrorResponse('Image could not be decoded', 422, origin);
  }
  const decision = await moderate(jpeg, env);
  if (decision.status !== 'approved')
    return createJsonErrorResponse(
      decision.reason,
      decision.status === 'rejected' ? 422 : 503,
      origin,
      decision.status
    );
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', webp.slice().buffer)
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const key = imageKey(identity.username, hash);
  await env.PROFILE_PICTURES.put(key, webp, {
    httpMetadata: { contentType: 'image/webp' },
    sha256: hash,
  });
  const pointer: Pointer = {
    version: 1,
    key,
    sha256: hash,
    contentType: 'image/webp',
    size: webp.length,
    updatedAt: new Date().toISOString(),
  };
  const stored = await env.PROFILE_PICTURES.put(
    pointerKey(identity.username),
    JSON.stringify(pointer),
    {
      onlyIf: before.etag
        ? { etagMatches: before.etag }
        : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    }
  );
  if (!stored)
    return createJsonErrorResponse(
      'Avatar changed concurrently; retry',
      409,
      origin
    );
  return createJsonResponse(
    {
      url: imageUrl(req, identity.username, hash),
      sha256: hash,
      size: webp.length,
      updatedAt: pointer.updatedAt,
    },
    200,
    origin
  );
}

export async function deleteMyAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const origin = getRequestOrigin(req);
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const before = await readPointer(env.PROFILE_PICTURES, identity.username);
  if (!before.value?.key)
    return createJsonResponse({ deleted: false }, 200, origin);
  const tombstone: Pointer = {
    version: 1,
    key: null,
    sha256: null,
    contentType: null,
    size: 0,
    updatedAt: new Date().toISOString(),
  };
  const stored = await env.PROFILE_PICTURES.put(
    pointerKey(identity.username),
    JSON.stringify(tombstone),
    {
      onlyIf: { etagMatches: before.etag! },
      httpMetadata: { contentType: 'application/json' },
    }
  );
  if (!stored)
    return createJsonErrorResponse(
      'Avatar changed concurrently; retry',
      409,
      origin
    );
  return createJsonResponse({ deleted: true }, 200, origin);
}

export async function getMyAvatar(req: Request, env: Env): Promise<Response> {
  const origin = getRequestOrigin(req);
  const identity = await owner(req, env);
  if (identity instanceof Response) return identity;
  const current = await readPointer(env.PROFILE_PICTURES, identity.username);
  return createJsonResponse(
    {
      username: identity.username,
      url: current.value?.sha256
        ? imageUrl(req, identity.username, current.value.sha256)
        : null,
    },
    200,
    origin
  );
}

export async function getPublicAvatar(
  req: Request,
  env: Env
): Promise<Response> {
  const path = new URL(req.url).pathname.slice(ROOT.length).split('/');
  if (
    (req.method !== 'GET' && req.method !== 'HEAD') ||
    (path.length !== 1 && path.length !== 2)
  )
    return new Response(null, { status: 404 });
  const [username, filename] = path;
  if (!username || !USERNAME.test(username))
    return new Response(null, { status: 404 });
  const current = await readPointer(env.PROFILE_PICTURES, username);
  if (!current.value?.key || !current.value.sha256)
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  if (!filename)
    return new Response(null, {
      status: 302,
      headers: {
        Location: imageUrl(req, username, current.value.sha256),
        'Cache-Control': 'no-store',
      },
    });
  const hash = filename.endsWith('.webp') ? filename.slice(0, -5) : '';
  if (
    !HASH.test(hash) ||
    current.value.sha256 !== hash ||
    current.value.key !== imageKey(username, hash)
  )
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const object =
    req.method === 'HEAD'
      ? await env.PROFILE_PICTURES.head(current.value.key)
      : await env.PROFILE_PICTURES.get(current.value.key);
  if (!object)
    return new Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const headers = new Headers({
    'Content-Type': 'image/webp',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ETag: object.httpEtag,
  });
  if (req.headers.get('if-none-match') === object.httpEtag)
    return new Response(null, { status: 304, headers });
  const body =
    req.method === 'HEAD'
      ? null
      : 'body' in object
        ? (object.body as ReadableStream<Uint8Array>)
        : null;
  return new Response(body, { status: 200, headers });
}
