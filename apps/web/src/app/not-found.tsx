import { Button } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center">
      <ErrorPageFlag />
      <FeedbackState
        code="404"
        title="Page not found"
        description="The address may be incorrect, or the page may have moved."
        actions={
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              Return to SCS home
            </Link>
          </Button>
        }
      />
    </main>
  );
}
