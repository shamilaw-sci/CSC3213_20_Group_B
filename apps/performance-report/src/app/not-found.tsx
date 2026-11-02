import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-sm font-semibold">REPORT NOT FOUND</p>
      <h1 className="mt-4 text-3xl font-semibold">No matching local run</h1>
      <p className="text-subtle mt-2">
        The run identifier is invalid or its report data is unavailable.
      </p>
      <Link className="mt-6 inline-block underline" href="/">
        Return to reports
      </Link>
    </main>
  );
}
