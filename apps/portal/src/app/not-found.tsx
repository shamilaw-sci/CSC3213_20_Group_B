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
        title="Portal page not found"
        description="The page may have moved, or your account may not have access to that destination."
        actions={
          <Link href="/" className={buttonVariants()}>
            <ArrowLeft className="size-4" />
            Return to Portal home
          </Link>
        }
      />
    </main>
  );
}
