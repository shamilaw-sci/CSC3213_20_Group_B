import { buttonVariants } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function DirectoryRouteNotFound({
  title,
  description,
  href,
  actionLabel,
}: Readonly<{
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}>) {
  return (
    <main className="flex min-h-[70vh] items-center">
      <ErrorPageFlag />
      <FeedbackState
        code="404"
        title={title}
        description={description}
        actions={
          <Link href={href} className={buttonVariants()}>
            <ArrowLeft className="size-4" />
            {actionLabel}
          </Link>
        }
      />
    </main>
  );
}
