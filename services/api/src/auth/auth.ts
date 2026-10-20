import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

import {
  ALLOWED_ORIGINS,
  COOKIE_DOMAIN,
  COOKIE_MAX_AGE_SECONDS,
  PASSKEY_RP_IDS,
  PASSKEY_RP_NAME,
} from '@/config/client.config';
import { sendEmail } from '@/services/mailer.service';
import {
  ACCESS_LEVEL,
  defaultRoleForEmail,
  getUserPermission,
  setUserPermission,
} from '@/repositories/permissions.repo';
import { waitUntil } from '@/runtime/request-context';
import type { Env } from '@/types/env';
import { isAllowedEmailDomain } from '@/utils/email-domains';

const AUTH_BASE_PATH = '/api/auth';
const OTP_EXPIRES_IN_SECONDS = 300;

function requestOrigin(request: Request): string {
  return request.headers.get('origin') ?? 'https://portal.scs-pdn.space';
}

function passkeyRpId(request: Request): string {
  return PASSKEY_RP_IDS[requestOrigin(request)] ?? 'scs-pdn.space';
}

function otpEmail(otp: string): { html: string; text: string } {
  return {
    html: `<p>Your SCS Portal sign-in code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes. If you did not request it, ignore this email.</p>`,
    text: `Your SCS Portal sign-in code is ${otp}. It expires in 5 minutes. If you did not request it, ignore this email.`,
  };
}

export function createAuth(request: Request, env: Env) {
  const production = env.BETTER_AUTH_URL.startsWith('https://');

  return betterAuth({
    appName: 'SCS Portal',
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    database: env.AUTH_DB,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: ALLOWED_ORIGINS,
    user: {
      validateUserInfo: ({ user }) => {
        if (!user.email || !isAllowedEmailDomain(user.email)) {
          return {
            error: 'university_email_required',
            errorDescription: 'Use a University of Peradeniya email address.',
          };
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            const email = user.email.toLowerCase();
            const permission = await getUserPermission(email, env);
            if (permission) return;

            await setUserPermission(
              email,
              {
                role: defaultRoleForEmail(email),
                accessLevel: ACCESS_LEVEL.NONE,
                name: user.name,
                ...(user.image ? { picture: user.image } : {}),
                createdAt: Date.now(),
              },
              env
            );
          },
        },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        requireEmailVerification: true,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: 'database',
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },
    session: {
      expiresIn: COOKIE_MAX_AGE_SECONDS,
      updateAge: 60 * 60,
      freshAge: 60 * 60,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: 'jwe',
      },
    },
    verification: {
      storeIdentifier: 'hashed',
      storeInDatabase: true,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
    },
    advanced: {
      useSecureCookies: production,
      cookiePrefix: 'scs-auth',
      defaultCookieAttributes: {
        httpOnly: true,
        secure: production,
        sameSite: production ? 'none' : 'lax',
        path: '/',
      },
      crossSubDomainCookies: production
        ? { enabled: true, domain: COOKIE_DOMAIN }
        : { enabled: false },
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
        ipv6Subnet: 64,
      },
      backgroundTasks: {
        handler: (promise) => waitUntil(request, promise),
      },
      database: {
        joins: true,
      },
    },
    plugins: [
      emailOTP({
        allowedAttempts: 3,
        disableSignUp: false,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        otpLength: 6,
        storeOTP: 'hashed',
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return;
          const content = otpEmail(otp);
          await sendEmail(
            {
              to: email,
              subject: 'SCS Portal sign-in code',
              ...content,
            },
            env.MAILER_API_URL,
            env.MAILER_API_KEY
          );
        },
      }),
      passkey({
        rpID: passkeyRpId(request),
        rpName: PASSKEY_RP_NAME,
        origin: ALLOWED_ORIGINS,
        registration: {
          requireSession: true,
        },
      }),
    ],
  });
}

export function isBetterAuthRequest(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  return (
    pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`)
  );
}
