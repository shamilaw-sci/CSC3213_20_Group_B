import { z } from 'zod';

export const KnownSocialPlatforms = [
  'linkedin',
  'github',
  'mastodon',
  'bluesky',
  'x',
  'facebook',
  'instagram',
  'youtube',
  'orcid',
  'googleScholar',
  'researchGate',
  'academia',
] as const;

export type KnownSocialPlatform = (typeof KnownSocialPlatforms)[number];

export const KnownSocialLabels = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  orcid: 'ORCID',
  googleScholar: 'Google Scholar',
  researchGate: 'ResearchGate',
  academia: 'Academia.edu',
} as const satisfies Record<KnownSocialPlatform, string>;

export const KnownSocialIcons = {
  linkedin: { type: 'simple-icons', slug: 'linkedin' },
  github: { type: 'simple-icons', slug: 'github' },
  mastodon: { type: 'simple-icons', slug: 'mastodon' },
  bluesky: { type: 'simple-icons', slug: 'bluesky' },
  x: { type: 'simple-icons', slug: 'x' },
  facebook: { type: 'simple-icons', slug: 'facebook' },
  instagram: { type: 'simple-icons', slug: 'instagram' },
  youtube: { type: 'simple-icons', slug: 'youtube' },
  orcid: { type: 'simple-icons', slug: 'orcid' },
  googleScholar: { type: 'simple-icons', slug: 'googlescholar' },
  researchGate: { type: 'simple-icons', slug: 'researchgate' },
  academia: { type: 'simple-icons', slug: 'academia' },
} as const satisfies Record<
  KnownSocialPlatform,
  { type: 'simple-icons'; slug: string }
>;

const domainHandlePattern =
  /^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

function urlFromInput(value: string): URL | null {
  const input = value.trim();
  if (input === '') return null;

  if (URL.canParse(input)) return new URL(input);
  if (URL.canParse(`https://${input}`)) return new URL(`https://${input}`);

  return null;
}

function cleanPathPart(value: string): string {
  return decodeURIComponent(value).trim().replace(/^@/, '').replace(/\/+$/, '');
}

function isAllowedHost(hostname: string, allowed: string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return allowed.includes(host);
}

function normalizeBareHandle(value: string): string {
  return value.trim().replace(/^@/, '').replace(/\/+$/, '');
}

function normalizeLinkedin(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value);

  if (url && isAllowedHost(url.hostname, ['linkedin.com'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'in' || !parts[1] || parts.length > 2) return null;
    handle = cleanPathPart(parts[1]);
  }

  if (!/^[a-zA-Z0-9-]{3,100}$/.test(handle)) return null;
  return `https://www.linkedin.com/in/${handle}`;
}

function normalizeGithub(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value);

  if (url && isAllowedHost(url.hostname, ['github.com'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    handle = cleanPathPart(parts[0] ?? '');
  }

  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(handle) ||
    handle.includes('--')
  ) {
    return null;
  }

  return `https://github.com/${handle}`;
}

function normalizeMastodon(value: string): string | null {
  const handleMatch =
    /^@?([A-Za-z0-9_]{1,30})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.exec(
      value.trim()
    );
  if (handleMatch) {
    return `https://${handleMatch[2]?.toLowerCase()}/@${handleMatch[1]}`;
  }

  const url = urlFromInput(value);
  let username = '';
  let server = '';

  if (url) {
    server = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]?.startsWith('@')) username = cleanPathPart(parts[0]);
    else if (parts[0] === 'users' && parts[1]) {
      username = cleanPathPart(parts[1]);
    }
  }

  if (
    !/^[A-Za-z0-9_]{1,30}$/.test(username) ||
    !domainHandlePattern.test(server)
  ) {
    return null;
  }

  return `https://${server}/@${username}`;
}

function normalizeBluesky(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value).toLowerCase();

  if (url) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'profile' || !parts[1] || parts.length > 2) return null;
    handle = cleanPathPart(parts[1]).toLowerCase();
  }

  if (!domainHandlePattern.test(handle)) return null;
  return `https://bsky.app/profile/${handle}`;
}

function normalizeX(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value);

  if (url && isAllowedHost(url.hostname, ['x.com', 'twitter.com'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    handle = cleanPathPart(parts[0] ?? '');
  }

  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return `https://x.com/${handle}`;
}

function normalizeFacebook(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value);

  if (url && isAllowedHost(url.hostname, ['facebook.com', 'fb.com'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    handle = cleanPathPart(parts[0] ?? '');
  }

  if (!/^[A-Za-z0-9.]{5,50}$/.test(handle)) return null;
  return `https://www.facebook.com/${handle}`;
}

function normalizeInstagram(value: string): string | null {
  const url = urlFromInput(value);
  let handle = normalizeBareHandle(value);

  if (url && isAllowedHost(url.hostname, ['instagram.com'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    handle = cleanPathPart(parts[0] ?? '');
  }

  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}`;
}

function normalizeYoutube(value: string): string | null {
  const url = urlFromInput(value);
  let handle = value.trim();

  if (url && isAllowedHost(url.hostname, ['youtube.com', 'youtu.be'])) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (
      parts[0] === 'channel' &&
      /^UC[A-Za-z0-9_-]{20,}$/.test(parts[1] ?? '')
    ) {
      return `https://www.youtube.com/channel/${parts[1]}`;
    }
    if (parts[0]?.startsWith('@')) handle = parts[0];
    else if (['c', 'user'].includes(parts[0] ?? '') && parts[1]) {
      handle = parts[1];
    } else {
      return null;
    }
  }

  handle = normalizeBareHandle(handle);
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(handle)) return null;
  return `https://www.youtube.com/@${handle}`;
}

function normalizeOrcid(value: string): string | null {
  const input = value.trim();
  const url = urlFromInput(input);
  const id =
    url && isAllowedHost(url.hostname, ['orcid.org'])
      ? url.pathname.replace(/^\//, '').replace(/\/$/, '')
      : input;
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id)) return null;
  return `https://orcid.org/${id.toUpperCase()}`;
}

function normalizeGoogleScholar(value: string): string | null {
  const input = value.trim();
  const url = urlFromInput(input);
  const id =
    url && isAllowedHost(url.hostname, ['scholar.google.com'])
      ? url.pathname === '/citations'
        ? url.searchParams.get('user')
        : null
      : input;
  if (!id || !/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  return `https://scholar.google.com/citations?user=${encodeURIComponent(id)}`;
}

function normalizeResearchGate(value: string): string | null {
  const input = value.trim();
  const url = urlFromInput(input);
  const handle =
    url && isAllowedHost(url.hostname, ['researchgate.net'])
      ? /^\/profile\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1]
      : input;
  if (!handle || !/^[A-Za-z0-9_-]{2,100}$/.test(handle)) return null;
  return `https://www.researchgate.net/profile/${handle}`;
}

function normalizeAcademia(value: string): string | null {
  const input = value.trim();
  const url = urlFromInput(input);
  if (url) {
    const host = url.hostname.toLowerCase();
    if (host === 'academia.edu' || host.endsWith('.academia.edu')) {
      const handle = /^\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
      return handle ? `https://${host}/${handle}` : null;
    }
  }
  if (!/^[A-Za-z0-9_-]{2,100}$/.test(input)) return null;
  return `https://www.academia.edu/${input}`;
}

export function normalizeKnownSocialUrl(
  platform: KnownSocialPlatform,
  value: string
): string | null {
  if (value.trim() === '') return null;

  if (platform === 'linkedin') return normalizeLinkedin(value);
  if (platform === 'github') return normalizeGithub(value);
  if (platform === 'mastodon') return normalizeMastodon(value);
  if (platform === 'bluesky') return normalizeBluesky(value);
  if (platform === 'x') return normalizeX(value);
  if (platform === 'facebook') return normalizeFacebook(value);
  if (platform === 'instagram') return normalizeInstagram(value);
  if (platform === 'youtube') return normalizeYoutube(value);
  if (platform === 'orcid') return normalizeOrcid(value);
  if (platform === 'googleScholar') return normalizeGoogleScholar(value);
  if (platform === 'researchGate') return normalizeResearchGate(value);
  return normalizeAcademia(value);
}

export function detectKnownSocialUrl(
  value: string
): { platform: KnownSocialPlatform; url: string } | null {
  for (const platform of KnownSocialPlatforms) {
    const url = normalizeKnownSocialUrl(platform, value);
    if (url) return { platform, url };
  }

  return null;
}

export const SocialIconSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('simple-icons'),
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
  }),
  z.object({
    type: z.literal('font-awesome'),
    style: z.literal('brands').default('brands'),
    name: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
  }),
  z.object({
    type: z.literal('url'),
    url: z.url(),
  }),
]);

const knownSocialValuesSchema = z
  .object(
    Object.fromEntries(
      KnownSocialPlatforms.map((platform) => [
        platform,
        z.string().trim().min(1).optional(),
      ])
    ) as Record<KnownSocialPlatform, z.ZodOptional<z.ZodString>>
  )
  .optional();

export const SocialLinksSchema = z
  .object({
    urls: knownSocialValuesSchema,
    profiles: z
      .array(
        z.object({
          platform: z.enum(KnownSocialPlatforms),
          url: z.string().trim().min(1),
        })
      )
      .optional(),
    otherPlatforms: z
      .array(
        z.object({
          platformName: z.string().trim().optional(),
          url: z.url(),
          icon: z.unknown().optional(),
        })
      )
      .optional(),
  })
  .transform((value, ctx) => {
    const urls: Partial<Record<KnownSocialPlatform, string>> = {};
    const profiles: Array<{ platform: KnownSocialPlatform; url: string }> = [];
    const otherPlatforms: Array<{
      platformName: string;
      url: string;
      icon?: z.infer<typeof SocialIconSchema>;
    }> = [];

    function addKnown(
      platform: KnownSocialPlatform,
      url: string,
      path: Array<string | number>
    ) {
      if (!urls[platform]) {
        urls[platform] = url;
      } else if (
        urls[platform] !== url &&
        !profiles.some(
          (entry) => entry.platform === platform && entry.url === url
        )
      ) {
        if (
          profiles.filter((entry) => entry.platform === platform).length >= 2
        ) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: `At most three ${platform} profiles are allowed`,
          });
          return;
        }
        profiles.push({ platform, url });
      }
    }

    if (value.urls) {
      for (const platform of KnownSocialPlatforms) {
        const input = value.urls[platform];
        if (!input) continue;

        const normalized = normalizeKnownSocialUrl(platform, input);
        if (!normalized) {
          ctx.addIssue({
            code: 'custom',
            path: ['urls', platform],
            message: `Invalid ${platform} profile URL or username`,
          });
          continue;
        }

        addKnown(platform, normalized, ['urls', platform]);
      }
    }

    for (const [index, profile] of (value.profiles ?? []).entries()) {
      const normalized = normalizeKnownSocialUrl(profile.platform, profile.url);
      if (!normalized) {
        ctx.addIssue({
          code: 'custom',
          path: ['profiles', index, 'url'],
          message: `Invalid ${profile.platform} profile URL or username`,
        });
        continue;
      }
      addKnown(profile.platform, normalized, ['profiles', index, 'url']);
    }

    for (const [index, platform] of (value.otherPlatforms ?? []).entries()) {
      const known = detectKnownSocialUrl(platform.url);
      if (known) {
        addKnown(known.platform, known.url, ['otherPlatforms', index, 'url']);
        continue;
      }

      if (!platform.platformName) {
        ctx.addIssue({
          code: 'custom',
          path: ['otherPlatforms', index, 'platformName'],
          message: 'Custom links need a platform name',
        });
        continue;
      }
      const icon =
        platform.icon === undefined
          ? null
          : SocialIconSchema.safeParse(platform.icon);
      if (icon && !icon.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['otherPlatforms', index, 'icon'],
          message: 'Invalid custom link icon',
        });
        continue;
      }
      otherPlatforms.push({
        platformName: platform.platformName,
        url: platform.url,
        ...(icon?.success ? { icon: icon.data } : {}),
      });
    }

    if (otherPlatforms.length > 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['otherPlatforms'],
        message: 'At most ten custom links are allowed',
      });
    }

    const result: {
      urls?: Partial<Record<KnownSocialPlatform, string>>;
      profiles?: typeof profiles;
      otherPlatforms?: typeof otherPlatforms;
    } = {};

    if (Object.keys(urls).length > 0) result.urls = urls;
    if (profiles.length > 0) result.profiles = profiles;
    if (otherPlatforms.length > 0) result.otherPlatforms = otherPlatforms;

    return result;
  });

export type SocialIcon = z.infer<typeof SocialIconSchema>;
export type SocialLinks = z.infer<typeof SocialLinksSchema>;
