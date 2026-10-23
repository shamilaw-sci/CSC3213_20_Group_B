import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';

import publicEnvConfig from '@/config/public.env.config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for SCS PDN Portal.',
  alternates: {
    canonical: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/privacy`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const googleScopes = [
  {
    scope: 'openid',
    purpose: 'Associates your Google account with your portal sign-in session.',
  },
  {
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    purpose: 'Reads your primary Google Account email address.',
  },
  {
    scope: 'https://www.googleapis.com/auth/userinfo.profile',
    purpose:
      'Reads your basic profile details, including public personal information.',
  },
];

export default function PrivacyPage() {
  return (
    <main
      className="bg-muted text-foreground min-h-screen px-3 py-8 sm:px-6
        sm:py-12"
    >
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm
              font-medium"
          >
            SCS PDN Portal
          </Link>
          <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm">
            Effective date: July 23, 2026
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              SCS PDN Portal is used by students, staff, and administrators of
              the Department of Statistics and Computer Science, University of
              Peradeniya. When you sign in with Google, the portal requests only
              the minimum information needed to identify your account and create
              a secure session.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {googleScopes.map((item) => (
                <li key={item.scope} className="min-w-0">
                  <span
                    className="text-foreground font-medium
                      [overflow-wrap:anywhere]"
                  >
                    {item.scope}
                  </span>
                  : {item.purpose}
                </li>
              ))}
            </ul>
            <p>
              The portal may also store account details you provide or that are
              needed for portal features, such as your name, email address,
              profile image, role, project access, and administrative settings.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              How We Use Information
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              We use this information to authenticate users, maintain portal
              accounts, authorize access to student, staff, and administrative
              services, show profile information inside the portal, and keep
              audit records required for operational security.
            </p>
            <p>
              We do not sell your personal information. We do not use Google
              user data for advertising, profiling, or unrelated marketing.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Sharing, Retention, and Control
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              Personal information is shared only with authorized portal
              administrators and service providers that help operate the portal.
              Access is limited to what is necessary for academic,
              administrative, security, or support purposes.
            </p>
            <p>
              We retain account information for as long as needed to provide the
              portal, meet institutional record requirements, resolve issues,
              and protect the service. You may revoke Google access from your
              Google Account permissions at any time.
            </p>
            <p>
              To request access, correction, or deletion of portal account data,
              contact the Department of Statistics and Computer Science,
              University of Peradeniya.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
