import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div
      className="text-muted-foreground flex min-h-screen items-center
        justify-center gap-2"
    >
      <Loader2 className="size-5 animate-spin" />
      Loading...
    </div>
  );
}
