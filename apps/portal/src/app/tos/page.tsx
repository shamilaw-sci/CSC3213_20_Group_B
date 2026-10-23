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
  title: 'Terms of Service',
  description: 'Terms of service for SCS PDN Portal.',
  alternates: {
    canonical: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/tos`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm">
            Effective date: July 23, 2026
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Use of the Portal
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              SCS PDN Portal provides access to academic and administrative
              services for students, staff, and administrators of the Department
              of Statistics and Computer Science, University of Peradeniya. You
              may use the portal only for authorized academic, administrative,
              and institutional purposes.
            </p>
            <p>
              You are responsible for keeping your account secure and for all
              activity performed using your account. Do not share access,
              impersonate another user, attempt to bypass authorization, or use
              the portal in a way that disrupts the service.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Google Sign-In
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              The portal may use Google Sign-In to authenticate users. When you
              sign in with Google, the portal requests only openid,
              userinfo.email, and userinfo.profile permissions so it can
              identify your account and maintain your portal session.
            </p>
            <p>
              Your use of Google services is also governed by Google&apos;s own
              terms and privacy policies.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Service Availability and Changes
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              The portal is provided for institutional use and may be updated,
              interrupted, restricted, or discontinued when required for
              maintenance, security, policy, or operational reasons.
            </p>
            <p>
              We may update these terms from time to time. Continued use of the
              portal after changes are published means you accept the updated
              terms.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg leading-snug sm:text-xl">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-muted-foreground min-w-0 space-y-4 px-4 text-sm
              leading-7 sm:px-6"
          >
            <p>
              Questions about these terms should be directed to the Department
              of Statistics and Computer Science, University of Peradeniya.
            </p>
            <p>
              For information about personal data practices, read the{' '}
              <Link href="/privacy" className="text-foreground font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
