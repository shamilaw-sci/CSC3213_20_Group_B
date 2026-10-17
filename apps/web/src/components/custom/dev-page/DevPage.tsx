import { Construction } from 'lucide-react';

export default function DevPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <Construction className="h-10 w-10 text-gray-500 mb-4" />
      <h1 className="text-2xl font-semibold text-gray-900">
        Page Under Development
      </h1>
      <p className="mt-3 max-w-md text-gray-600">
        This page is currently under development and will be available soon.
        Please check back later.
      </p>
    </div>
  );
}
