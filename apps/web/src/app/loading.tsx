import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center gap-2
        text-gray-600"
    >
      <Loader2 className="size-5 animate-spin" />
      Loading...
    </div>
  );
}
