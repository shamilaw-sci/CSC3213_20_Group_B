import { buttonVariants } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center">
      <ErrorPageFlag />
      <FeedbackState
        code="404"
        icon={
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt=""
            width={72}
            height={72}
          />
        }
        title="Project page not found"
        description="The project, course, or category may have moved. Return to discovery to continue browsing."
        actions={
          <Link href="/" className={buttonVariants()}>
            <ArrowLeft className="size-4" />
            Browse projects
          </Link>
        }
      />
    </main>
  );
}
