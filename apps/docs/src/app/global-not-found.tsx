import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { buttonVariants } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import Link from 'next/link';

import { DocsFallbackIcon } from '@/components/layout/docs-fallback-icon';

export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body
        className="bg-fd-background text-fd-foreground flex min-h-screen
          items-center"
      >
        <FeedbackState
          code="404"
          icon={<DocsFallbackIcon />}
          title="Page not found"
          description="This address does not match a page on the documentation site."
          actions={
            <Link href="/docs" className={buttonVariants()}>
              Open the handbook
            </Link>
          }
        />
      </body>
    </html>
  );
}
