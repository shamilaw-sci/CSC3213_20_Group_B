import { buttonVariants } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center">
      <ErrorPageFlag />
      <FeedbackState
        code="404"
        title="Documentation page not found"
        description="The page may have moved, or the address may be incorrect."
        actions={
          <Link href="/docs" className={buttonVariants()}>
            Open the handbook
          </Link>
        }
      />
    </main>
  );
}
