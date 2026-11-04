/**
 * One-time public avatar import. The API performs the same validation and Jev
 * moderation as an ordinary owner upload. A successful current pointer makes
 * reruns a no-op; failures are reported without altering public profile JSON.
 */
const source = {
  username: 's21513',
  url: 'https://sivothayan.com/images/me-at-shq.jpeg',
};

const cookie = process.env.AVATAR_MIGRATION_SESSION_COOKIE;
if (!cookie)
  throw new Error(
    'Set AVATAR_MIGRATION_SESSION_COOKIE to an owner session cookie'
  );
const base =
  process.env.AVATAR_MIGRATION_API_URL ?? 'https://api.scs-pdn.space';
const endpoint = `${base}/api/people/v2/avatars/me`;
const headers = { Cookie: cookie };
const currentResponse = await fetch(endpoint, { headers });
if (!currentResponse.ok)
  throw new Error(`Owner lookup failed: ${currentResponse.status}`);
const current = (await currentResponse.json()) as {
  username: string;
  url: string | null;
};
if (current.username !== source.username)
  throw new Error(
    `Authenticated owner ${current.username} does not match ${source.username}`
  );
if (current.url) {
  console.log(`${source.username}: already has an approved avatar; skipped`);
  process.exit(0);
}

const remote = await fetch(source.url, {
  redirect: 'follow',
  signal: AbortSignal.timeout(15_000),
});
if (!remote.ok)
  throw new Error(`${source.username}: source unavailable (${remote.status})`);
const bytes = await remote.arrayBuffer();
if (bytes.byteLength === 0 || bytes.byteLength > 4 * 1024 * 1024)
  throw new Error(`${source.username}: source exceeds upload limits`);
const form = new FormData();
form.append('image', new File([bytes], 'source.jpeg', { type: 'image/jpeg' }));
const upload = await fetch(endpoint, {
  method: 'POST',
  headers,
  body: form,
  signal: AbortSignal.timeout(30_000),
});
const result = (await upload.json()) as { url?: string; error?: string };
if (!upload.ok || !result.url)
  throw new Error(
    `${source.username}: import failed (${upload.status}): ${result.error ?? 'unknown error'}`
  );
console.log(`${source.username}: imported ${result.url}`);
