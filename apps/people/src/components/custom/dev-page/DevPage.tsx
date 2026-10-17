import { Construction } from 'lucide-react';

export default function DevPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <Construction className="mb-4 h-10 w-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">
        Page Under Development
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This page is currently under development and will be available soon.
        Please check back later.
      </p>
    </div>
  );
}
