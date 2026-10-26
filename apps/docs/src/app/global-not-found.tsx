import '@/app/globals.css';

import { Button } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        className="bg-fd-background text-fd-foreground flex min-h-screen
          items-center"
      >
        <FeedbackState
          code="404"
          title="Page not found"
          description="This address does not match a page on the documentation site."
          actions={
            <Button asChild>
              <Link href="/docs">Open the handbook</Link>
            </Button>
          }
        />
      </body>
    </html>
  );
}
