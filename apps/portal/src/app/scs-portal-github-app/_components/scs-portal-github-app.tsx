import { ExternalLink, ShieldAlert } from 'lucide-react';

import { PageHeader, PageShell } from '@/components/layout/page-shell';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

export default function SCSPortalGitHubApp() {
  return (
    <PageShell width="narrow">
      <PageHeader
        title="SCS Portal GitHub App"
        description="GitHub integration used internally by the SCS Portal."
        icon={<GitHubIcon className="size-6" />}
      />

      <div className="space-y-6">
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 flex items-start
            gap-4 rounded-md border p-5"
        >
          <div
            className="border-destructive/30 bg-background flex size-10 shrink-0
              items-center justify-center rounded-md border"
          >
            <ShieldAlert className="text-destructive size-5" />
          </div>

          <div className="space-y-1">
            <h2 className="font-semibold">
              External installation is not recommended
            </h2>

            <p className="text-muted-foreground text-sm/6">
              This GitHub App is intended only for use with the SCS Portal. It
              automatically processes repository pull requests and commits
              required by the portal and is not designed or supported for use by
              external users or unrelated repositories.
            </p>
          </div>
        </div>

        <section
          className="bg-card text-card-foreground space-y-4 rounded-md border
            p-6 shadow-sm"
        >
          <div className="space-y-1">
            <h2 className="font-semibold">Purpose</h2>

            <p className="text-muted-foreground text-sm/6">
              The SCS Portal GitHub App connects approved repositories to the
              portal and handles automated GitHub operations such as processing
              pull requests and commits.
            </p>
          </div>

          <div className="space-y-1 border-t pt-4">
            <h2 className="font-semibold">Installation</h2>

            <p className="text-muted-foreground text-sm/6">
              Install this application only when instructed by an SCS Portal
              administrator and only on an approved GitHub account,
              organization, or repository.
            </p>
          </div>

          <div className="space-y-1 border-t pt-4">
            <h2 className="font-semibold">Liability notice</h2>

            <p className="text-muted-foreground text-sm/6">
              External users who install or use this application do so at their
              own risk. The application owners, developers, maintainers,
              contributors, and the SCS Portal team are not liable for any data
              loss, repository changes, service interruption, security issue, or
              other damage resulting from unauthorized or unsupported use, to
              the fullest extent permitted by applicable law.
            </p>
          </div>
        </section>

        <div
          className="bg-muted/30 flex flex-col gap-3 rounded-md border p-5
            sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-muted-foreground text-sm/6">
            By installing the app outside its intended environment, you accept
            all risks associated with unsupported use.
          </p>

          <a
            href="https://github.com/apps/scs-portal-github-app"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90
              focus-visible:ring-ring inline-flex h-10 shrink-0 items-center
              justify-center gap-2 rounded-md px-4 text-sm font-medium
              transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            View GitHub App
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
    </PageShell>
  );
}
