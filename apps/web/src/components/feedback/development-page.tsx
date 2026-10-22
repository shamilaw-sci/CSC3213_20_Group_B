import { FeedbackState } from '@scs/ui/components/feedback-state';
import { Construction } from 'lucide-react';

export function DevelopmentPage() {
  return (
    <FeedbackState
      className="min-h-[60vh] justify-center"
      icon={<Construction className="size-10" />}
      title="Page under development"
      description={
        <p>
          This page is currently under development and will be available soon.
          Please check back later.
        </p>
      }
    />
  );
}
